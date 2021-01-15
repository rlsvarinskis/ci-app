declare namespace SidebarLessNamespace {
  export interface ISidebarLess {
    navbar: string;
  }
}

declare const SidebarLessModule: SidebarLessNamespace.ISidebarLess & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: SidebarLessNamespace.ISidebarLess;
};

export = SidebarLessModule;
