import type {PasswordLocale} from '../auth/password-recovery-policy';
const copy={
 en:{reset:'Reset your password — Cashback+',changed:'Your password was changed — Cashback+',hello:'Hello',instruction:'Use this link within 30 minutes to choose a new password. Ignore this email if you did not request it.',notice:'Your password was changed. All previous sessions were revoked. Contact support if this was not you.'},
 ru:{reset:'Восстановление пароля — Cashback+',changed:'Пароль изменён — Cashback+',hello:'Здравствуйте',instruction:'Выберите новый пароль по ссылке в течение 30 минут. Если вы не запрашивали восстановление, проигнорируйте письмо.',notice:'Пароль изменён. Прежние сессии отозваны. Если это были не вы, обратитесь в поддержку.'},
 de:{reset:'Passwort zurücksetzen — Cashback+',changed:'Ihr Passwort wurde geändert — Cashback+',hello:'Hallo',instruction:'Wählen Sie innerhalb von 30 Minuten über diesen Link ein neues Passwort. Ignorieren Sie diese E-Mail, falls Sie dies nicht angefordert haben.',notice:'Ihr Passwort wurde geändert. Alle bisherigen Sitzungen wurden widerrufen. Kontaktieren Sie den Support, wenn Sie dies nicht waren.'},
 fr:{reset:'Réinitialisation du mot de passe — Cashback+',changed:'Votre mot de passe a été modifié — Cashback+',hello:'Bonjour',instruction:'Choisissez un nouveau mot de passe avec ce lien dans les 30 minutes. Ignorez ce message si vous ne l’avez pas demandé.',notice:'Votre mot de passe a été modifié. Les sessions précédentes ont été révoquées. Contactez le support si vous n’êtes pas à l’origine de cette action.'},
};
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
export function passwordTemplate(kind:'reset_request'|'password_changed',name:string,locale:PasswordLocale,link?:string){
 const c=copy[locale];
 if(kind==='reset_request'&&!link)throw Error('Password link unavailable');
 const text=c.hello+', '+name+'!\n'+(kind==='reset_request'?c.instruction+'\n'+link:c.notice);
 return{subject:kind==='reset_request'?c.reset:c.changed,text,html:'<p>'+escape(text).replace(/\n/g,'<br>')+'</p>'};
}
