declare namespace UseritemLessNamespace {
  export interface IUseritemLess {
    filedownload: string;
    usericon: string;
    useritem: string;
  }
}

declare const UseritemLessModule: UseritemLessNamespace.IUseritemLess & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: UseritemLessNamespace.IUseritemLess;
};

export = UseritemLessModule;
