import type { VercelRequest, VercelResponse } from '@vercel/node';

import { errorResponse } from '../../../api-lib/HttpError';
import okResponse from '../../../api-lib/okResponse';
import { EventTriggerPayload } from '../../../api-lib/types';
import { verifyHasuraRequestMiddleware } from '../../../api-lib/validate';

import handleNomineeVouchedInMsg from './utils/handleNomineeVouchedInMsg';

async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const payload: EventTriggerPayload<'nominees', 'UPDATE'> = req.body;
    const sent = await handleNomineeVouchedInMsg(payload, { discord: true });
    return okResponse(res, {
      message: `Discord message ${sent ? 'sent' : 'not sent'}`,
    });
  } catch (e) {
    return errorResponse(res, e);
  }
}

export default verifyHasuraRequestMiddleware(handler);
