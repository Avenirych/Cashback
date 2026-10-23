import {render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {LanguageProvider} from '../context/LanguageContext';
import DemoClosed from './DemoClosed';
test.each([['ru','Демонстрационный режим'],['en','Demonstration mode'],['de','Demonstrationsmodus'],['fr','Mode démonstration']])('demo closed route is localized and has no registration form: %s',(lang,title)=>{localStorage.setItem('lang',lang);const view=render(<LanguageProvider><MemoryRouter><DemoClosed/></MemoryRouter></LanguageProvider>);expect(screen.getByRole('heading',{name:title})).toBeVisible();expect(view.container.querySelector('form')).toBeNull();expect(screen.getByRole('link')).toHaveAttribute('href','/');});
