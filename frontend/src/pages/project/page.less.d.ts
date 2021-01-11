declare namespace PageLessNamespace {
  export interface IPageLess {
    content: string;
    page: string;
  }
}

declare const PageLessModule: PageLessNamespace.IPageLess & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: PageLessNamespace.IPageLess;
};

export = PageLessModule;
