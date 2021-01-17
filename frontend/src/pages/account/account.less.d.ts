declare namespace AccountLessNamespace {
  export interface IAccountLess {
    formpage: string;
    formrow: string;
    page: string;
    title: string;
  }
}

declare const AccountLessModule: AccountLessNamespace.IAccountLess & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: AccountLessNamespace.IAccountLess;
};

export = AccountLessModule;
