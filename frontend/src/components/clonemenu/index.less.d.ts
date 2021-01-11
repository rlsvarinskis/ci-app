declare namespace IndexLessNamespace {
  export interface IIndexLess {
    clonebutton: string;
    clonemenu: string;
    copycontainer: string;
    copytype: string;
  }
}

declare const IndexLessModule: IndexLessNamespace.IIndexLess & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: IndexLessNamespace.IIndexLess;
};

export = IndexLessModule;
