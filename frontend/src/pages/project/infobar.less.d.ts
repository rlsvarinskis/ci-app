declare namespace InfobarLessNamespace {
  export interface IInfobarLess {
    clonebutton: string;
    infobar: string;
    link: string;
    projecttitle: string;
    sectionedit: string;
    sectionmore: string;
    sectiontitle: string;
    setting: string;
    settingvalue: string;
  }
}

declare const InfobarLessModule: InfobarLessNamespace.IInfobarLess & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: InfobarLessNamespace.IInfobarLess;
};

export = InfobarLessModule;
