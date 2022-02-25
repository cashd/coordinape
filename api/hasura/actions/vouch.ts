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
    const { nominee_id: nomineeId, circle_id: circleId } = input;

    // validate that this is allowed
    const { voucher } = await validate(circleId, nomineeId, voucherProfileId);

    // vouch and build user if needed
    const updatedNominee = await vouch(nomineeId, voucher, circleId);

    return res.status(200).json({ id: updatedNominee.id });
  } catch (e: any) {
    return ErrorResponse(res, e);
  }
}

async function validate(
  circleId: number,
  nomineeId: number,
  voucherProfileId: number
) {
  // make sure circle exists
  const { circles_by_pk: circle } = await gql.getCircle(circleId);
  if (!circle) {
    throw new NotFoundError('circle not found');
  }

  // Check if voucher exists in the same circle as the nominee
  // TODO: this uses assert for error handling
  const voucher = await getUserFromProfileId(voucherProfileId, circleId);

  // If circle only allows giver to vouch, make sure voucher is a giver
  if (circle.only_giver_vouch && voucher.non_giver) {
    throw new ForbiddenError(
      "voucher is a 'non-giver' so is not allowed to vouch"
    );
  }

  // Get the nominee
  const nominee = await getNominee(nomineeId);

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

async function vouch(nomineeId: number, voucher: voucher, circleId: number) {
  // vouch for the nominee
  if (!(await gql.insertVouch(nomineeId, voucher.id))) {
    throw new InternalServerError('unable to add vouch');
  }

  // refetch the nominee now to update the nomination/vouch count
  const nominee = await getNominee(nomineeId);

  // announce the vouching
  await sendSocialMessage({
    message: `${nominee.name} has been vouched for by ${voucher.name}!`,
    circleId: circleId,
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
    return await convertNomineeToUser(nominee, circleId);
  }

  return nominee;
}

async function convertNomineeToUser(nominee: nominee, circleId: number) {
  // Get the nominee into the user table
  let userId = nominee.user_id;
  if (!userId) {
    const addedUser = await gql.insertUser(
      nominee.address,
      nominee.name,
      circleId
    );
    if (!addedUser) {
      throw new InternalServerError('unable to add user');
    }
    userId = addedUser.id;
  }

  // Make sure they have a profile too
  const { profiles } = await gql.getProfileAndMembership(nominee.address);
  if (profiles.length == 0) {
    const addedProfiles = await gql.insertProfiles([
      {
        address: nominee.address,
      },
    ]);
    if (!addedProfiles) {
      throw new InternalServerError('unable to add profile for new user');
    }
  }

  // attach the user id to the nominee, and mark the nomination ended
  const updatedNominee = await gql.updateNomineeUser(nominee.id, userId);
  if (!updatedNominee) {
    throw new InternalServerError('unable to update nominee userId');
  }

  // announce that they are vouched in
  await sendSocialMessage({
    message: `${nominee.name} has received enough vouches and is now in the circle!`,
    circleId: circleId,
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

type voucher = Awaited<ReturnType<typeof getUserFromProfileId>>;
type nominee = Awaited<ReturnType<typeof getNominee>>;
