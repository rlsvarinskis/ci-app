import React from 'react';
import ReactMarkdown from 'react-markdown';
import gfm from 'remark-gfm';
import { ProjectMember } from 'components/projectlist';
import page from 'pages/project/page/page.less';
import infobar from 'pages/project/infobar/infobar.less';
import ProjectSidebar from 'components/projectsidebar';
import { FileItem, UserItem } from './useritem/useritem';
import ToggleButton from 'components/togglebutton';
import selects from 'components/select/index.less';
import { CloneMenu } from 'components/clonemenu';
import Navbar from 'components/navbar';
import { getAPIURL, getBaseURL, ProjectName, ProjectNavbarItems, ProjectPageProps } from './common';
import { FailResponses, load, put, request, SuccessfulResponse } from 'utils/xhr';
import { ProjectInfo, DataProvider, ReadmeProvider } from './providers';
import ErrorPage from 'pages/error';
import { Link } from 'react-router-dom';

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
                {/*
                    isOwner ? <div>
                        <p>
                            Default branch permission: <select className={selects.select} onChange={evt => this.setDefaultBP(evt)} disabled={this.state.projectInfo === "loading" || this.state.projectInfo == null || this.state.loadingDefaultPerm !== false} value={this.state.projectInfo != "loading" && this.state.projectInfo != null ? this.state.projectInfo.default_branch_permissions : ""}>{BranchPermissions.map(x => <option key={x} value={x}>{BranchPermissionsText[x]}</option>)}</select>
                        </p>
                    </div> : <></>*/
                }
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
                        {/*<div className={infobar.setting}>Branch permissions: <div className={infobar.settingvalue}><ToggleButton onToggle={newVal => this.setPrivate(newVal)} disabled={this.state.projectInfo === "loading" || this.state.projectInfo == null || this.state.loadingPrivate !== false} checked={this.state.projectInfo != "loading" ? this.state.projectInfo != null ? this.state.projectInfo.private : "intermediate" : "intermediate"}></ToggleButton></div></div>*/}
                    </div> : <></>
                }
                <div>
                    <div className={infobar.sectiontitle}>Release</div>
                    <FileItem filename="Minecraft.exe" icon={{type: "url", url: "https://www.freeiconspng.com/thumbs/minecraft-png-icon/minecraft-icon-0.png"}}></FileItem>
                </div>
                <div>
                    {isOwner && <Link to={devsUrl} className={infobar.link + " " + infobar.sectionedit}>Transfer ownership</Link>}
                    <div className={infobar.sectiontitle}>Owner</div>
                    <UserItem username={this.props.info.owner} />
                </div>
                {
                    (!isOwner && this.props.members.length === 0) ? <></> : <div>
                        {isOwner && <Link to={devsUrl} className={infobar.link + " " + infobar.sectionedit}>Change developers</Link>}
                        <div className={infobar.sectiontitle}>Developers</div>
                        {this.props.members.length === 0 && /*Empty*/ <></>}
                        {this.props.members.map(x => <UserItem key={x.username} username={x.username} />)}
                        <Link to={devsUrl} className={infobar.link + " " + infobar.sectionmore}>View all developers</Link>
                    </div>
                }
            </div>
        </>
    }
};

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