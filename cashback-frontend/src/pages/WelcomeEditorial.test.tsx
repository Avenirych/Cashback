import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import Welcome from './Welcome';
import {ruAuthorGreeting} from '../content/russianEditorial';
jest.mock('../components/ReviewsCarousel',()=>({__esModule:true,default:()=>null,reviewDisplayMode:()=> 'demo'}));

test('Russian home preserves the complete author text below its compact availability strip',()=>{
 const view=render(<MemoryRouter><Welcome lang="RU"/></MemoryRouter>);
 const greeting=screen.getByText(ruAuthorGreeting);
 expect(greeting).toBeVisible();
 expect(greeting.textContent).toBe('Получайте кэшбэк, бонусы за просмотр рекламы и участие в исследованиях. Комбинируйте их и компенсируйте до 100% своих покупок.');
 const strip=view.container.querySelector('.home-demo-strip')!;
 expect(strip).toHaveTextContent('реальные вознаграждения и выплаты недоступны');
 expect(strip.compareDocumentPosition(greeting)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(screen.getAllByRole('heading',{level:1})).toHaveLength(1);
 expect(view.container.querySelectorAll('.home-demo-strip')).toHaveLength(1);
});

test.each(['EN','DE','FR'])('%s does not receive new Russian editorial text',lang=>{
 const view=render(<MemoryRouter><Welcome lang={lang}/></MemoryRouter>);
 expect(screen.queryByText(ruAuthorGreeting)).not.toBeInTheDocument();
 expect(view.container.querySelector('.home-demo-strip')).toBeNull();
 expect(view.container.querySelector('.welcome-steps')).toBeNull();
});
