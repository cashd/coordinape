import { gql } from '../../../../api-lib/Gql';
import { sendSocialMessage } from '../../../../api-lib/sendSocialMessage';
import { EventTriggerPayload } from '../../../../api-lib/types';

export default async function handleVouchMsg(
  payload: EventTriggerPayload<'vouches', 'INSERT'>,
  channels: { discord?: boolean; telegram?: boolean }
) {
  const {
    event: { data },
  } = payload;

  const { voucher } = data.new;
  if (!voucher) {
    throw 'voucher not found';
  }

  const nomineeId = data.new.nominee_id;

  const { nominees_by_pk } = await gql.getNominee(nomineeId);
  if (!nominees_by_pk) {
    throw 'nominee not found ' + nomineeId;
  }

  // announce the vouching
  await sendSocialMessage({
    message: `${nominees_by_pk.name} has been vouched for by ${voucher.name}!`,
    circleId: nominees_by_pk.circle_id,
    sanitize: true,
    channels,
  });

  return true;
}
