import Navbar from 'components/navbar';
import { FolderItem, SourceCodeItem, LoadingItem, ErrorItem } from 'components/navbar/item';
import ProjectSidebar from 'components/sidebar';
import React from 'react';
import { Link, match, Route, Switch } from 'react-router-dom';
import { FailResponses, load } from 'utils/xhr';
import { getAPIURL, getBaseURL, ProjectNavbarItems, ProjectPageProps } from '../common';
import page from 'pages/project/page/page.less';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import { ViewDirectory } from './directory';
import styles from './directory.less';
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Prism } from 'react-syntax-highlighter';
const map = require('language-map');

interface ProjectSourceProps extends ProjectPageProps {
    match?: match<{
        file: string;
    }>;
    file: string[];
};

export class ProjectSource extends React.Component<ProjectSourceProps> {
    render() {
        const filename = [...this.props.file];
        if (this.props.match) {
            filename.push(this.props.match.params.file);
        }
        const baseurl = getBaseURL(this.props.project, "src", ...filename);
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
            } else if (cm.startsWith("text/")) {
                switch (cm) {
                    case "text/directory":
                        pageResults = <ViewDirectory baseUrl={getBaseURL(this.props.project, "src", ...this.props.filename)} content={this.state.content} />
                        break;
                    case "text/markdown":
                        pageResults = <ViewMarkdown content={this.state.content} />
                        break;
                    default:
                        pageResults = <ViewTextFile content={this.state.content} mimeType={cm} filename={this.props.filename[this.props.filename.length - 1]} />
                        break;
                }
            } else {
                pageResults = <ViewTextFile content={this.state.content} mimeType={cm} filename={this.props.filename[this.props.filename.length - 1]} />
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
                        {this.props.filename.length > 0 ? <Link to={getBaseURL(this.props.project, "src", ...this.props.filename.slice(0, this.props.filename.length - 1))} className={styles.back}><i className="fas fa-chevron-left" /></Link> : <></>}
                        <h2 className={styles.filename}>{name}</h2>
                        {pageResults}
                    </div>
                </div>
            </>
        );
    }
}

interface FileProps {
    content: Blob;
};

interface TextFileProps extends FileProps {
    mimeType: string;
    filename: string;
};

interface FileState {
    content?: string | false;
    lastContent?: Blob;
};

interface TextFileState extends FileState {
    language: string;
}

class ViewTextFile extends React.Component<TextFileProps, TextFileState> {
    state: TextFileState = {
        language: ""
    };

    componentDidMount() {
        this.reload();
    }

    componentDidUpdate() {
        this.reload();
    }

    reload() {
        if (this.state.lastContent !== this.props.content) {
            if (this.props.content.size > 1024 * 1024 * 8) {
                this.setState({
                    content: false,
                    lastContent: this.props.content
                });
            } else {
                this.props.content.text().then(result => {
                    const extension = this.props.filename.split(".");
                    let language = "";
                    if (extension.length > 1) {
                        const last = extension[extension.length - 1];
                        const possibleKey = Object.keys(map).find(x => map[x].filenames?.some((y: string) => y === this.props.filename) || map[x].extensions?.some((y: string) => y === last));
                        if (possibleKey != null) {
                            const possibleLanguage = map[possibleKey];
                            language = possibleLanguage.aceMode || possibleKey.toLowerCase();
                        }
                    }
                    this.setState({
                        content: result,
                        lastContent: this.props.content,
                        language: language
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
            return <Prism style={vs} language={this.state.language} showLineNumbers={true} customStyle={{
                borderColor: "rgba(0, 0, 0, 0.05)"
            }}>
                {this.state.content}
            </Prism>
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
            return <div className={styles.filedisplay}>
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
        return <div className={styles.filedisplay + " " + styles.imagedisplay}>
            <img src={this.state.url} style={{maxWidth: "45rem"}} />
        </div>
    }
}
