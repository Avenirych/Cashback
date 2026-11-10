import {passwordLocale} from '../auth/password-recovery-policy';
import {passwordTemplate} from './password-templates';

// Template/fallback contracts only. These do not prove a saved account-language source
// or a multilingual recovery-confirm flow. No app, DB, network or SMTP bootstrap.
const cases=[
 ['ru','Пароль изменён — Cashback+','Пароль изменён.'],
 ['en','Your password was changed — Cashback+','Your password was changed.'],
 ['de','Ihr Passwort wurde geändert — Cashback+','Ihr Passwort wurde geändert.'],
 ['fr','Votre mot de passe a été modifié — Cashback+','Votre mot de passe a été modifié.'],
] as const;
test.each(cases)('%s changed notification uses consistent subject/text/HTML',(locale,subject,notice)=>{
 const selected=passwordLocale(locale);
 const mail=passwordTemplate('password_changed','<Synthetic>',selected);
 expect(selected).toBe(locale);
 expect(mail.subject).toBe(subject);
 expect(mail.text).toContain(notice);
 expect(mail.html).toContain(notice);
 expect(mail.html).toContain('&lt;Synthetic&gt;');
 expect(mail.html).not.toContain('<Synthetic>');
});
test.each([undefined,null,'','es','ru-RU',17,{}])('unsupported/missing locale row %# uses EN',(value)=>{
 const selected=passwordLocale(value);
 expect(selected).toBe('en');
 const mail=passwordTemplate('password_changed','Synthetic',selected);
 expect(mail.subject).toBe(cases[1][1]);
 expect(mail.text).toContain(cases[1][2]);
 expect(mail.html).toContain(cases[1][2]);
});
test('supported uppercase locale is normalized with the existing helper',()=>{
 expect(passwordLocale('RU')).toBe('ru');
});
