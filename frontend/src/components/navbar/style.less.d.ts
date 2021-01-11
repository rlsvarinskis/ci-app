declare namespace StyleLessNamespace {
  export interface IStyleLess {
    center: string;
    logout: string;
    navbar: string;
    profileimage: string;
  }
}

declare const StyleLessModule: StyleLessNamespace.IStyleLess & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: StyleLessNamespace.IStyleLess;
};

export = StyleLessModule;
