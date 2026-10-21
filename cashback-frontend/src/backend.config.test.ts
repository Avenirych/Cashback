import {BACKEND_URL} from './backend';
import {FORUM_API_URL} from './forum';
test('historical auth/profile and forum share the configured origin',()=>{expect(FORUM_API_URL).toBe(BACKEND_URL);expect(BACKEND_URL.endsWith('/')).toBe(false);});
