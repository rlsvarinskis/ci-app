import Navbar from 'components/navbar';
import { FolderItem, SourceCodeItem, LoadingItem, ErrorItem } from 'components/navbar/item';
import ProjectSidebar from 'components/projectsidebar';
import React from 'react';
import { Link, match, Route, Switch } from 'react-router-dom';
import { FailResponses, load } from 'utils/xhr';
import { getAPIURL, getBaseURL, ProjectNavbarItems, ProjectPageProps } from '../common';
import page from 'pages/project/page/page.less';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';

interface ProjectSourceProps extends ProjectPageProps {
    match?: match<{
        file: string;
    }>;
    file: string[];
};

export class ProjectSource extends React.Component<ProjectSourceProps> {
    render() {
        const filename = [...this.props.file];
        console.log("Routing into ", filename);
        if (this.props.match) {
            filename.push(this.props.match.params.file);
        }
        console.log("Really into ", filename);
        const baseurl = getBaseURL(this.props.project, "src", ...filename);
        console.log("Baseurl:", baseurl);
        return <Switch>
            <Route path={baseurl + "/:file"} render={props => <ProjectSource match={props.match} user={this.props.user} project={this.props.project} file={filename} />} />
            <Route path={baseurl}>
                <RetrieveFileContents project={this.props.project} user={this.props.user} filename={filename} />
            </Route>
        </Switch>
    }
}

interface FileContentsProps extends ProjectPageProps {
    filename: string[];
};

interface FileContentsStateLoading {
    loading: true | FailResponses;
    lastFilename?: string[];
};

interface FileContentsStateLoaded {
    loading: false;
    contentMime: string;
    content: Blob;
    lastFilename?: string[];
};

type FileContentsState = FileContentsStateLoaded | FileContentsStateLoading;

class RetrieveFileContents extends React.Component<FileContentsProps, FileContentsState> {
    state: FileContentsState = {
        loading: true
    };

    componentDidMount() {
        this.reload();
    }

    componentDidUpdate() {
        this.reload();
    }

    reload() {
        if (this.state.lastFilename === this.props.filename) {
            return;
        }
        const fn = this.props.filename.length === 0 ? [""] : this.props.filename;
        load("GET", getAPIURL(this.props.project, "src", "master", ...fn)).then(result => {
            if (result.type === "success") {
                this.setState({
                    loading: false,
                    contentMime: result.data.mimeType,
                    content: result.data.data,
                    lastFilename: this.props.filename
                });
            } else {
                this.setState({
                    loading: result,
                    lastFilename: this.props.filename
                });
            }
        });
    }

    getNavbar() {
        let nav: JSX.Element[] = [];
        const items = [...this.props.filename];
        const lastItem = items.pop();
        if (lastItem != null) {
            const files = items.reduce((a, c) => {
                const target = a.parent + "/" + c;
                a.parent = target;
                a.acc.push(<FolderItem key={target} path={target}>{c}</FolderItem>);
        
                return a;
            }, {parent: getBaseURL(this.props.project, "src"), acc: [] as JSX.Element[]});
            nav = files.acc;

            const lastUrl = files.parent + "/" + lastItem;

            if (this.state.loading === false) {
                switch (this.state.contentMime.split(";", 2)[0]) {
                    case "text/directory":
                        nav.push(<FolderItem key={lastUrl} path={lastUrl}>{lastItem}</FolderItem>);
                        break;
                    default:
                        nav.push(<SourceCodeItem key={lastUrl} path={lastUrl}>{lastItem}</SourceCodeItem>);
                        break;
                }
            } else if (this.state.loading === true) {
                nav.push(<LoadingItem key={lastUrl} path={lastUrl}>{lastItem}</LoadingItem>);
            } else {
                nav.push(<ErrorItem key={lastUrl} path={lastUrl}>{lastItem}</ErrorItem>);
            }
        }
        return nav;
    }

    render() {
        let pageResults: JSX.Element = <></>;
        if (this.state.loading === false) {
            const cm = this.state.contentMime.split(";", 2)[0];
            if (cm.startsWith("image/")) {
                pageResults = <ViewImage content={this.state.content} />
            } else {
                switch (cm) {
                    case "text/directory":
                        pageResults = <ViewDirectory baseUrl={getBaseURL(this.props.project, "src", ...this.props.filename)} content={this.state.content} />
                        break;
                    case "text/markdown":
                        pageResults = <ViewMarkdown content={this.state.content} />
                        break;
                    default:
                        pageResults = <ViewFile content={this.state.content} />
                        break;
                }
            }
        } else if (this.state.loading === true) {
            pageResults = <div>Loading...</div>;
        } else {
            pageResults = <div>Error! {this.state.loading.toString()}</div>;
        }
        const name = this.props.filename.length === 0 ? "Source code" : this.props.filename.join("/");
        return (
            <>
                <Navbar user={this.props.user}><ProjectNavbarItems project={this.props.project} /><FolderItem path={getBaseURL(this.props.project, "src")}>Source code</FolderItem>{...this.getNavbar()}</Navbar>
                <ProjectSidebar baseurl={getBaseURL(this.props.project)} active="src"></ProjectSidebar>
                <div className={page.content + " " + page.mini}>
                    <div className={page.page}>
                        <h1>{name}</h1>
                        {pageResults}
                    </div>
                </div>
            </>
        );
    }
}

interface DirectoryProps {
    baseUrl: string;
    content: Blob;
};

interface DirectoryState {
    folders?: {
        mode: string;
        type: string;
        name: string;
    }[];
    lastContent?: Blob;
};

class ViewDirectory extends React.Component<DirectoryProps, DirectoryState> {
    state: DirectoryState = {};

    componentDidMount() {
        this.reload();
    }

    componentDidUpdate() {
        this.reload();
    }

    reload() {
        const content = this.props.content;
        console.log("Reloading!", content, this.state.lastContent, this.state.lastContent === content, this.state.lastContent == content);
        if (this.state.lastContent !== content) {
            content.text().then(result => {
                console.log("Reloaded!");
                this.setState({
                    folders: result.split("\n").map(x => {
                        var fold = x.trim().split(" ");
                        return {
                            mode: fold[0],
                            type: fold[1],
                            name: fold[2]
                        };
                    }),
                    lastContent: content
                });
            }, error => {
                console.error(error);
            });
        }
    }

    render() {
        return <div>
            {
                ...(this.state.folders != null ? this.state.folders.map(folder => {
                    return <div>
                        <Link key={this.props.baseUrl + "/" + folder.name} to={this.props.baseUrl + "/" + folder.name}>
                            <i className={folder.type === "tree" ? "fas fa-folder" : "fas fa-file"} />{folder.name}
                        </Link>
                    </div>;
                }) : [])
            }
        </div>
    }
}

interface FileProps {
    content: Blob;
};

interface FileState {
    content?: string | false;
    lastContent?: Blob;
};

class ViewFile extends React.Component<FileProps, FileState> {
    state: FileState = {};

    componentDidMount() {
        this.reload();
    }

    componentDidUpdate() {
        this.reload();
    }

    reload() {
        console.log("Reloading!");
        if (this.state.lastContent !== this.props.content) {
            if (this.props.content.size > 1024 * 1024 * 8) {
                this.setState({
                    content: false,
                    lastContent: this.props.content
                });
            } else {
                this.props.content.text().then(result => {
                    this.setState({
                        content: result,
                        lastContent: this.props.content
                    });
                }, error => {
                    console.error(error);
                });
            }
        }
    }

    render() {
        if (this.state.content === false) {
            return <div>File too large</div>;
        } else if (this.state.content == null) {
            return <div>Loading...</div>;
        } else {
            return <div>
                <code>
                    {this.state.content}
                </code>
            </div>
        }
    }
}

class ViewMarkdown extends React.Component<FileProps, FileState> {
    state: FileState = {};

    componentDidMount() {
        this.reload();
    }

    componentDidUpdate() {
        this.reload();
    }

    reload() {
        console.log("Reloading!");
        if (this.props.content !== this.state.lastContent) {
            if (this.props.content.size > 1024 * 1024 * 8) {
                this.setState({
                    content: false,
                    lastContent: this.props.content
                });
            } else {
                this.props.content.text().then(result => {
                    this.setState({
                        content: result,
                        lastContent: this.props.content
                    });
                }, error => {
                    console.error(error);
                });
            }
        }
    }

    render() {
        if (this.state.content === false) {
            return <div>File too large</div>;
        } else if (this.state.content == null) {
            return <div>Loading...</div>;
        } else {
            return <div>
                <ReactMarkdown plugins={[gfm]}>{this.state.content}</ReactMarkdown>
            </div>
        }
    }
}

interface ImageState {
    url: string;
};

class ViewImage extends React.Component<FileProps, ImageState> {
    static getDerivedStateFromProps(props: FileProps, state: ImageState) {
        return {
            url: URL.createObjectURL(props.content)
        };
    }

    render() {
        return <div>
            <img src={this.state.url} />
        </div>
    }
}
