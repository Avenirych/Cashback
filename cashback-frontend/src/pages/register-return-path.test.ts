import {safeReturnPath} from './Register';
test('rejects precisely every previously forbidden control character',()=>{for(const code of [...Array.from({length:32},(_,i)=>i),127])expect(safeReturnPath('/bonuses/a'+String.fromCharCode(code)+'b')).toBeNull();});
test.each(['/shop','/bonuses','/bonuses/ads?x=1#demo'])('retains allowed registration return destination %s',path=>expect(safeReturnPath(path)).toBe(path));
test.each([null,'','//evil.test','https://evil.test','/bonuses\\evil','/profile'])('retains redirect protection for %s',path=>expect(safeReturnPath(path)).toBeNull());
