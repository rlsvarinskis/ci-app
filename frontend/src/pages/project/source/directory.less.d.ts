declare namespace DirectoryLessNamespace {
  export interface IDirectoryLess {
    back: string;
    empty: string;
    file: string;
    filecontainer: string;
    filedisplay: string;
    filename: string;
    filetable: string;
    imagedisplay: string;
  }
}

declare const DirectoryLessModule: DirectoryLessNamespace.IDirectoryLess & {
  /** WARNING: Only available when `css-loader` is used without `style-loader` or `mini-css-extract-plugin` */
  locals: DirectoryLessNamespace.IDirectoryLess;
};

export = DirectoryLessModule;
