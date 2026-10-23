import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
test('renders Cashback public navigation and restored information links',async()=>{
  const fetchIndex=jest.spyOn(global,'fetch').mockResolvedValue({ok:true,json:async()=>[]} as Response);
  const network=jest.spyOn(XMLHttpRequest.prototype,'open');
  try {
  localStorage.clear();sessionStorage.clear();window.history.replaceState({},'', '/');
  const view=render(<App/>);
  expect(screen.getByRole('banner')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:/Explore the catalogue|Посмотреть каталог/})).toBeEnabled();
  expect(screen.getByRole('button',{name:/Explore activities|Посмотреть задания/})).toBeEnabled();
  expect(document.querySelector('a[href="/privacy"]')).toBeInTheDocument();
  expect(document.querySelector('a[href="/faq"]')).toBeInTheDocument();
  await waitFor(()=>expect(fetchIndex).toHaveBeenCalledWith('/search-index.json',expect.objectContaining({cache:'no-cache',signal:expect.any(AbortSignal)})));
  const signal=(fetchIndex.mock.calls[0][1] as RequestInit).signal!;
  view.unmount();
  expect(signal.aborted).toBe(true);
  expect(network).not.toHaveBeenCalled();
  } finally { fetchIndex.mockRestore();network.mockRestore(); }
});
