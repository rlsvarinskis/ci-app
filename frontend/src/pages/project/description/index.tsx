import React from 'react';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import { ProjectMember } from 'components/projectlist';
import page from 'pages/project/page/page.less';
import infobar from './infobar/infobar.less';
import ProjectSidebar from 'components/sidebar';
import { EmptyItem, FileItem, UserItem } from '../../../components/useritem/useritem';
import ToggleButton from 'components/togglebutton';
import selects from 'components/select/index.less';
import { CloneMenu } from 'components/clonemenu';
import Navbar from 'components/navbar';
import { getAPIURL, getBaseURL, ProjectName, ProjectNavbarItems, ProjectPageProps } from '../common';
import { FailResponses, FileResponse, load, put, request, SuccessfulResponse, Response } from 'utils/xhr';
import { ProjectInfo, DataProvider, ReadmeProvider } from '../providers';
import ErrorPage from 'pages/error';
import { Link } from 'react-router-dom';
import { BranchPermissions, BranchPermissionsText } from 'components/projectmaker';

export default class ProjectMainPage extends React.Component<ProjectPageProps> {
    render() {
        return <>
            <Navbar user={this.props.user}><ProjectNavbarItems project={this.props.project} /></Navbar>
            <ProjectSidebar baseurl={getBaseURL(this.props.project)} active="main"></ProjectSidebar>
            <div className={page.content}>
                <ProjectDescriptionList project={this.props.project} user={this.props.user} />
            </div>
        </>;
    }
}

interface ProjectDescriptionData {
    project: ProjectInfo, members: ProjectMember[]
};

class ProjectDescriptionList extends DataProvider<ProjectDescriptionData> {
    update() {
        return {
            project: request<ProjectInfo>("GET", getAPIURL(this.props.project)),
            members: request<ProjectMember[]>("GET", getAPIURL(this.props.project, "members")),
            //Files
        };
    }

    renderLoading() {
        return <h2>Loading...</h2>;
    }

    renderError(error: FailResponses) {
        return <ErrorPage error={error} />
    }

    updateInfo(info: ProjectInfo) {
        this.setState(state => {
            if (state.data === "loading" || "error" in state.data) {
                return state;
            }

            const data = state.data.data;
            const newData = {
                project: {
                    ...data.project,
                    ...info
                },
                members: data.members
            };
            return {
                ...state,
                data: {
                    data: newData
                }
            };
        });
    }

    renderSuccess(data: ProjectDescriptionData) {
        return <ProjectDescription info={data.project} members={data.members} user={this.props.user} project={this.props.project} onInfoChange={info => this.updateInfo(info)} />
    }
}

interface ProjectDescriptionPageProps extends ProjectPageProps {
    info: ProjectInfo;
    members: ProjectMember[];
    onInfoChange: (info: ProjectInfo) => void;
};

interface ProjectMainPageState {
    error: any;
    loadingPrivate?: true | FailResponses;
    loadingDefaultPerm?: true | FailResponses;
};

class ProjectDescription extends React.Component<ProjectDescriptionPageProps, ProjectMainPageState> {
    state: ProjectMainPageState = {
        error: null,
    };

    setPrivate(newVal: boolean) {
        put(getAPIURL(this.props.project, "private"), newVal).then(result => {
            if (result.type === "success") {
                this.setState(state => ({
                    ...state,
                    loadingPrivate: undefined,
                }));
                this.props.onInfoChange({...this.props.info, private: newVal});
            } else {
                this.setState(state => ({
                    ...state,
                    loadingPrivate: result,
                }));
            }
        });
        this.setState(state => ({
            ...state,
            loadingPrivate: true,
        }));
    }

    setDefaultBP(evt: React.ChangeEvent<HTMLSelectElement>) {
        evt.preventDefault();
        const val = evt.currentTarget.value as "NONE" | "READ" | "WRITE";
        put(getAPIURL(this.props.project, "default_branch_permissions"), val).then(result => {
            if (result.type === "success") {
                this.setState(state => ({
                    ...state,
                    loadingDefaultPerm: undefined,
                }));
                this.props.onInfoChange({...this.props.info, default_branch_permissions: val});
            } else {
                this.setState(state => ({
                    ...state,
                    loadingDefaultPerm: result,
                }));
            }
        });
        this.setState(state => ({
            ...state,
            loadingDefaultPerm: true,
        }));
        return false;
    }

    render() {
        const isOwner = this.props.info.owner === this.props.user.username;
        const devsUrl = getBaseURL(this.props.project, "devs");
        return <>
            <div className={page.page}>
                <div className="readme">
                    <ProjectReadme project={this.props.project} user={this.props.user}></ProjectReadme>
                </div>
            </div>
            <div className={infobar.infobar}>
                <div>
                    {<CloneMenu sshClone={"ssh://git@" + window.location.hostname + ":" + this.props.info.sshPort + this.props.project.parent.map(x => "/" + x).join("") + "/" + this.props.project.project}></CloneMenu>}
                    <h3 className={infobar.projecttitle}>{this.props.project.project}</h3>
                    <p>{this.props.info.description}</p>
                </div>
                {
                    isOwner ? <div>
                        <div className={infobar.setting}>Private <div className={infobar.settingvalue}><ToggleButton onToggle={newVal => this.setPrivate(newVal)} disabled={this.state.loadingPrivate === true} checked={this.props.info.private} /></div></div>
                        <div className={infobar.setting}>Branches <div className={infobar.settingvalue}><select className={selects.select} onChange={evt => this.setDefaultBP(evt)} disabled={this.state.loadingDefaultPerm === true} value={this.props.info.default_branch_permissions}>{BranchPermissions.map(x => <option key={x} value={x}>{BranchPermissionsText[x]}</option>)}</select></div></div>
                    </div> : <></>
                }
                <ProjectFiles project={this.props.project} />
                <div>
                    {isOwner && <Link to={devsUrl} className={infobar.link + " " + infobar.sectionedit}>Transfer ownership</Link>}
                    <div className={infobar.sectiontitle}>Owner</div>
                    <UserItem username={this.props.info.owner} />
                </div>
                {
                    (!isOwner && this.props.members.length === 0) ? <></> : <div>
                        {isOwner && <Link to={devsUrl} className={infobar.link + " " + infobar.sectionedit}>Change developers</Link>}
                        <div className={infobar.sectiontitle}>Developers</div>
                        {this.props.members.length === 0 && <EmptyItem>No other developers</EmptyItem>}
                        {this.props.members.map(x => <UserItem key={x.username} username={x.username} />)}
                        <Link to={devsUrl} className={infobar.link + " " + infobar.sectionmore}>View all developers</Link>
                    </div>
                }
            </div>
        </>
    }
};

interface ProjectFilesProps {
    project: ProjectName;
};

interface ProjectFilesState {
    folder: string[];
    data?: Response<{
        folder: boolean;
        name: string;
    }[]>;
    lastProject: string[];
};

class ProjectFiles extends React.Component<ProjectFilesProps, ProjectFilesState> {
    state: ProjectFilesState;

    constructor(props: ProjectFilesProps) {
        super(props);
        this.state = {
            folder: [],
            lastProject: [...props.project.parent, props.project.project]
        };
    }

    update(folder: string[]) {
        load("GET", getAPIURL(this.props.project, "res", "branch", "master", ...folder) + (folder.length === 0 ? "/" : "")).then(result => {
            if (result.type === "success") {
                result.data.data.text().then(text => {
                    text = text.trim();
                    this.setState({
                        data: {
                            type: "success",
                            code: 200,
                            data: text.length === 0 ? [] : text.split("\r\n").map(line => {
                                const sp = line.split(" ", 2);
                                return {
                                    folder: sp[0] === "folder",
                                    name: sp[1]
                                };
                            })
                        }
                    });
                }, e => {
                    this.setState({
                        data: {
                            type: "error",
                            error: e
                        }
                    })
                });
            } else {
                this.setState({
                    data: result
                });
            }
        });
        this.setState({data: undefined});
    }

    componentDidMount() {
        this.update(this.state.folder);
    }

    updateFolder(folder: string[]) {
        this.setState({
            folder: folder,
        });
        this.update(folder);
    }

    componentDidUpdate() {
        if ([...this.props.project.parent, this.props.project.project].join("/") === this.state.lastProject.join("/")) {
            return;
        }

        this.update(this.state.folder);
    }

    renderLoading() {
        return <div>
            <div className={infobar.sectiontitle}>master</div>
            <span>Loading...</span>
        </div>
    }

    renderError() {
        return <div>
            <div className={infobar.sectiontitle}>master</div>
            <span>Failed to load: {JSON.stringify(this.state.data)}</span>
        </div>;
    }

    render() {
        const d = this.state.data;
        if (d == null) {
            return this.renderLoading();
        } else if (d.type === "success") {
            return <div>
                <div className={infobar.sectiontitle}>master</div>
                {
                    this.state.folder.length > 0 ? 
                    <FileItem
                        key={".."}
                        filename={".."}
                        target={() => this.updateFolder(this.state.folder.slice(0, this.state.folder.length - 1))}
                        icon={{type: "url", url: "https://www.ispsd.com/wp-content/uploads/2013/02/wpid-folder-icon-512x512.png"}}
                    /> : <></>
                }
                {
                    ...d.data.map(file => {
                        const icon = file.folder ? "https://www.ispsd.com/wp-content/uploads/2013/02/wpid-folder-icon-512x512.png" : file.name.endsWith(".zip") ? "https://www.iconhot.com/icon/png/sleek-xp-software/256/zip.png" : "https://i.pinimg.com/originals/7f/d2/e4/7fd2e46b2da9819e667fb75caf475cf7.png";
                        return <FileItem
                            key={[...this.state.folder, file.name].join("/")}
                            filename={file.name}
                            target={file.folder ? 
                                () => this.updateFolder([...this.state.folder, file.name]) :
                                getAPIURL(this.props.project, "res", "branch", "master", ...this.state.folder, file.name)
                            }
                            icon={{type: "url", url: icon}}
                        />
                    })
                }
            </div>;
        } else {
            return this.renderError();
        }
    }
}

interface ProjectReadmeProps {
    readme: string
};

class ProjectReadme extends DataProvider<ProjectReadmeProps> {
    update() {
        return {
            readme: load("GET", getAPIURL(this.props.project, "src", "master", "README.md")).then(async result => {
                if (result.type === "success") {
                    const text = await result.data.data.text();
                    const ans: SuccessfulResponse<string> = {
                        type: "success",
                        code: 200,
                        data: text
                    };
                    return ans;
                } else {
                    return result;
                }
            })
        };
    }

    renderLoading() {
        return <h2>Loading...</h2>;
    }

    renderError(error: FailResponses) {
        return <ErrorPage error={error} />
    }

    renderSuccess(data: ProjectReadmeProps) {
        return <ReactMarkdown plugins={[gfm]}>{data.readme}</ReactMarkdown>
    }
}