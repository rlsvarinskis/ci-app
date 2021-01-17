declare namespace FormLessNamespace {
  export interface IFormLess {
    formpage: string;
    formrow: string;
    page: string;
    title: string;
  }
}

declare const FormLessModule: FormLessNamespace.IFormLess & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: FormLessNamespace.IFormLess;
};

export = FormLessModule;
