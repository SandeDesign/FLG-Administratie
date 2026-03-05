import React, { createContext, useContext, useState, useEffect } from 'react';

interface PageTitleContextType {
  pageTitle: string;
  setPageTitle: (title: string) => void;
}

const PageTitleContext = createContext<PageTitleContextType>({
  pageTitle: '',
  setPageTitle: () => {},
});

export const PageTitleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pageTitle, setPageTitle] = useState('');
  return (
    <PageTitleContext.Provider value={{ pageTitle, setPageTitle }}>
      {children}
    </PageTitleContext.Provider>
  );
};

export const usePageTitle = (title: string) => {
  const { setPageTitle } = useContext(PageTitleContext);
  useEffect(() => {
    setPageTitle(title);
    return () => setPageTitle('');
  }, [title, setPageTitle]);
};

export const usePageTitleValue = () => {
  const { pageTitle } = useContext(PageTitleContext);
  return pageTitle;
};
