import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import WiseAccountNotice from './WiseAccountNotice';
test.each(['ru','en'])('Wise notice starts collapsed and can be opened/closed without losing content %s',lang=>{const v=render(<WiseAccountNotice lang={lang}/>);const details=v.container.querySelector('details')!;expect(details.open).toBe(false);const summary=details.querySelector('summary')!;expect(summary.textContent).toContain('Wise');fireEvent.click(summary);expect(details.open).toBe(true);expect(screen.getByRole('link')).toHaveAttribute('href','https://wise.com/register');fireEvent.click(summary);expect(details.open).toBe(false);});
