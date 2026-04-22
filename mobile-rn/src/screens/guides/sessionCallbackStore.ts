import { SessionCapture } from './SessionReviewScreen';

type SessionCallback = (captures: SessionCapture[]) => void;

let _callback: SessionCallback | null = null;

export const sessionCallbackStore = {
  set: (cb: SessionCallback) => {
    _callback = cb;
  },
  call: (captures: SessionCapture[]) => {
    if (_callback) {
      _callback(captures);
    }
  },
  clear: () => {
    _callback = null;
  },
};
