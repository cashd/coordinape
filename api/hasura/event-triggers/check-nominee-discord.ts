import type { VercelRequest, VercelResponse } from '@vercel/node';

import { verifyHasuraRequestMiddleware } from '../../../api-lib/validate';
import { EventTriggerPayload } from '../types';

import handleCheckNomineeMsg from './utils/handleCheckNomineeMsg';

async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const payload: EventTriggerPayload = req.body;
    const sent = await handleCheckNomineeMsg(payload, { discord: true });
    res
      .status(200)
      .json({ message: `Discord message ${sent ? 'sent' : 'not sent'}` });
  } catch (e) {
    res.status(500).json({
      error: '500',
      message: (e as Error).message || 'Unexpected error',
    });
  }
}

export default verifyHasuraRequestMiddleware(handler);
