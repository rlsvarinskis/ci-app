declare namespace NavbarLessNamespace {
  export interface INavbarLess {
    navbar: string;
  }
}

declare const NavbarLessModule: NavbarLessNamespace.INavbarLess & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: NavbarLessNamespace.INavbarLess;
};

export = NavbarLessModule;
