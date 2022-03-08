import { sendSocialMessage } from '../../../../api-lib/sendSocialMessage';
import { EventTriggerPayload } from '../../../../api-lib/types';

export default async function handleNomineeVouchedInMsg(
  payload: EventTriggerPayload<'nominees', 'UPDATE'>,
  channels: { discord?: boolean; telegram?: boolean }
) {
  const {
    event: { data },
  } = payload;

  // If user_id was not set, and now it is, that means it is a nominee that just became vouched in
  if (!data.old.user_id && data.new.user_id) {
    await sendSocialMessage({
      message: `${data.new.name} has received enough vouches and is now in the circle!`,
      circleId: data.new.circle_id,
      sanitize: true,
      channels,
    });
    return true;
  }
  return false;
}
