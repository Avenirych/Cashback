import {validateEmail} from './emailValidator';
test.each(['person@example.test','a-b+c_d@example-domain.test','a.b@example.co.uk',' A+B@example.test '])('keeps valid email semantics: %s',email=>expect(validateEmail(email).valid).toBe(true));
test.each(['','bad','a..b@example.test','.a@example.test','a.@example.test','a@-example.test','a@exam_ple.test','a@exam ple.test','a@example.t'])('keeps invalid email semantics: %s',email=>expect(validateEmail(email).valid).toBe(false));
test('ASCII acceptance remains equivalent to the original character classes',()=>{
 const legacy=new RegExp('^[a-zA-Z0-9._+\\-]{1,64}@[a-zA-Z0-9.\\-]{1,255}\\.[a-zA-Z]{2,}$');
 for(let code=0;code<128;code++){const char=String.fromCharCode(code),email=`ab${char}cd@example.test`;const expected=legacy.test(email)&&!email.includes('..');expect(validateEmail(email).valid).toBe(expected);}
});
