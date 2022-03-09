import { gql } from '../../../../api-lib/Gql';
import { NotFoundError } from '../../../../api-lib/HttpError';
import { sendSocialMessage } from '../../../../api-lib/sendSocialMessage';
import { EventTriggerPayload } from '../../../../api-lib/types';

export default async function handleVouchMsg(
  payload: EventTriggerPayload<'vouches', 'INSERT'>,
  channels: { discord?: boolean; telegram?: boolean }
) {
  const {
    event: { data },
  } = payload;

  // Unfortunately we have to look the vouch/voucher up here because the relationships aren't sent in the event
  const { vouches } = await gql.getExistingVouch(
    data.new.nominee_id,
    data.new.voucher_id
  );

  const vouch = vouches.pop();
  if (!vouch?.voucher) {
    throw new NotFoundError('voucher not found');
  }

  const nomineeId = data.new.nominee_id;

  const { nominees_by_pk } = await gql.getNominee(nomineeId);
  if (!nominees_by_pk) {
    throw 'nominee not found ' + nomineeId;
  }

  // announce the vouching
  await sendSocialMessage({
    message: `${nominees_by_pk.name} has been vouched for by ${vouch.voucher.name}!`,
    circleId: nominees_by_pk.circle_id,
    sanitize: true,
    channels,
  });

  return true;
}
