import type { VercelRequest, VercelResponse } from '@vercel/node';

import { getUserFromProfileId } from '../../../api-lib/findUser';
import { gql } from '../../../api-lib/Gql';
import {
  BadRequestError,
  ErrorResponse,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from '../../../api-lib/HttpError';
import { sendSocialMessage } from '../../../api-lib/sendSocialMessage';
import { Awaited } from '../../../api-lib/ts4.5shim';
import {
  composeHasuraActionRequestBodyWithSession,
  HasuraUserSessionVariables,
  vouchInput,
} from '../../../src/lib/zod';

type Voucher = Awaited<ReturnType<typeof getUserFromProfileId>>;
type Nominee = Awaited<ReturnType<typeof getNominee>>;

export default async function (req: VercelRequest, res: VercelResponse) {
  try {
    const {
      input: { payload: input },
      session_variables: sessionVariables,
    } = composeHasuraActionRequestBodyWithSession(
      vouchInput,
      HasuraUserSessionVariables
    ).parse(req.body);

    const { hasuraProfileId: voucherProfileId } = sessionVariables;
    const { nominee_id: nomineeId } = input;

    // validate that this is allowed
    const { voucher } = await validate(nomineeId, voucherProfileId);

    // vouch and build user if needed
    const updatedNominee = await vouch(nomineeId, voucher);

    return res.status(200).json({ id: updatedNominee.id });
  } catch (e: any) {
    return ErrorResponse(res, e);
  }
}

async function validate(nomineeId: number, voucherProfileId: number) {
  // Get the nominee
  const nominee = await getNominee(nomineeId);

  // make sure circle exists
  if (!nominee.circle) {
    throw new NotFoundError('circle not found');
  }

  // Check if voucher exists in the same circle as the nominee
  // TODO: this uses assert for error handling
  const voucher = await getUserFromProfileId(
    voucherProfileId,
    nominee.circle_id
  );

  // If circle only allows giver to vouch, make sure voucher is a giver
  if (nominee.circle.only_giver_vouch && voucher.non_giver) {
    throw new ForbiddenError(
      "voucher is a 'non-giver' so is not allowed to vouch"
    );
  }

  // make sure the nomination period hasn't ended
  if (nominee.ended) {
    throw new BadRequestError('nomination has already ended for this nominee');
  }

  // TODO: could this be handled by a unique index in the vouches table?
  // Check if voucher already has an existing vouch for the nominee
  if (nominee.nominated_by_user_id === voucher.id) {
    throw new ForbiddenError(
      "voucher nominated this nominee so can't additionally vouch"
    );
  }

  const { vouches } = await gql.getExistingVouch(nomineeId, voucher.id);

  if (vouches.pop()) {
    throw new ForbiddenError('voucher has already vouched for this nominee');
  }

  return {
    voucher,
  };
}

async function vouch(nomineeId: number, voucher: Voucher) {
  // vouch for the nominee

  // this inserts the vouch and also fetches the nominee with updated vouch count
  const insert_vouches = await gql.insertVouch(nomineeId, voucher.id);
  if (!insert_vouches?.nominee) {
    throw new InternalServerError('unable to add vouch');
  }

  const nominee = insert_vouches.nominee;

  // announce the vouching
  await sendSocialMessage({
    message: `${nominee.name} has been vouched for by ${voucher.name}!`,
    circleId: nominee.circle_id,
    sanitize: true,
    channels: {
      // TODO: figure out if these need to be conditionalized?
      discord: true,
      telegram: true,
    },
  });

  // if there are enough nominations, go ahead and add the user to the circle
  const nomCount = nominee.nominations_aggregate.aggregate?.count || 0;
  if (nominee.vouches_required - 1 <= nomCount) {
    return await convertNomineeToUser(nominee);
  }

  return nominee;
}

async function convertNomineeToUser(nominee: Nominee) {
  // Get the nominee into the user table
  let userId = nominee.user_id;
  if (!userId) {
    const addedUser = await gql.insertUser(
      nominee.address,
      nominee.name,
      nominee.circle_id
    );
    if (!addedUser) {
      throw new InternalServerError('unable to add user');
    }
    userId = addedUser.id;
  }

  // The profile is automatically created by the createProfile event trigger, if needed

  // attach the user id to the nominee, and mark the nomination ended
  const updatedNominee = await gql.updateNomineeUser(nominee.id, userId);
  if (!updatedNominee) {
    throw new InternalServerError('unable to update nominee userId');
  }

  // announce that they are vouched in
  await sendSocialMessage({
    message: `${nominee.name} has received enough vouches and is now in the circle!`,
    circleId: nominee.circle_id,
    sanitize: true,
    channels: {
      // TODO: figure out if these need to be conditionalized?
      discord: true,
      telegram: true,
    },
  });
  return updatedNominee;
}

async function getNominee(nomineeId: number) {
  const nom = await gql.getNominee(nomineeId);
  if (!nom.nominees_by_pk) {
    throw `nominee ${nomineeId} not found`;
  }
  return nom.nominees_by_pk;
}
