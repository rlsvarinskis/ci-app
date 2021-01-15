import React from 'react';
import { ProjectMember } from 'components/projectlist';
import page from 'pages/project/page/page.less';
import ProjectSidebar from 'components/sidebar';
import Navbar from 'components/navbar';
import { DevelopersItem } from 'components/navbar/item';
import { getAPIURL, getBaseURL, LoadingState, ProjectName, ProjectNavbarItems, ProjectPageProps } from '../common';
import { del, FailResponses, post, put, request } from 'utils/xhr';
import { DataProvider, ProjectInfo } from '../providers';
import ErrorPage from 'pages/error';
import { UserItem } from '../../../components/useritem/useritem';

export class ProjectDeveloperPage extends React.Component<ProjectPageProps> {
    render() {
        return <>
            <Navbar user={this.props.user}><ProjectNavbarItems project={this.props.project} /><DevelopersItem path={getBaseURL(this.props.project, "developers")}>Developers</DevelopersItem></Navbar>
            <ProjectSidebar baseurl={getBaseURL(this.props.project)} active="main"></ProjectSidebar>
            <div className={page.content}>
                <div className={page.page}>
                    <ProjectDeveloperList project={this.props.project} user={this.props.user}>{this.props.children}</ProjectDeveloperList>
                </div>
            </div>
        </>
    }
}

interface ProjectDeveloperData {
    project: ProjectInfo;
    members: ProjectMember[];
};

class ProjectDeveloperList extends DataProvider<ProjectDeveloperData> {
    update() {
        return {
            project: request<ProjectInfo>("GET", getAPIURL(this.props.project)),
            members: request<ProjectMember[]>("GET", getAPIURL(this.props.project, "members"))
        };
    }

    replaceOwners(oldOwner: string, newOwner: string) {
        this.setState(state => {
            if (state.data === "loading" || "error" in state.data) {
                return state;
            }

            const data = state.data.data;
            const newMember: ProjectMember = {
                username: oldOwner,
                make_branches: true,
                make_subprojects: true,
                make_tags: true,
                delete_tags: true
            };
            const newData = {
                project: {
                    ...data.project,
                    owner: newOwner
                },
                members: [...data.members.filter(x => x.username !== newOwner), newMember]
            };
            return {
                ...state,
                data: {
                    data: newData
                }
            };
        });
    }

    replaceMembers(members: ProjectMember[]) {
        this.setState(state => {
            if (state.data === "loading" || "error" in state.data) {
                return state;
            }

            const data = state.data.data;
            const newData = {
                ...data,
                members: members
            };
            return {
                ...state,
                data: {
                    data: newData
                }
            };
        });
    }

    renderLoading() {
        return <h2>Loading...</h2>;
    }

    renderError(error: FailResponses) {
        return <ErrorPage error={error} />
    }

    renderSuccess(data: ProjectDeveloperData) {
        const isOwner = this.props.user.username === data.project.owner;

        return <>
            <Owner project={this.props.project} isOwner={isOwner} owner={data.project.owner} onChange={(oldOwner, newOwner) => this.replaceOwners(oldOwner, newOwner)} />
            <ProjectDevelopers project={this.props.project} isOwner={isOwner} members={data.members} onChange={members => this.replaceMembers(members)} />
        </>
    }
}

class Owner extends React.Component<{
    project: ProjectName;
    owner: string;
    isOwner: boolean;
    onChange: (oldOwner: string, newOwner: string) => void;
}, LoadingState> {
    state: LoadingState = {};

    transferOwnership(evt: React.FormEvent<HTMLFormElement>) {
        evt.preventDefault();

        const el = evt.currentTarget.elements;

        const res = {
            username: (el.namedItem("username") as HTMLInputElement).value,
        };

        this.setState(state => ({
            ...state,
            loading: true,
        }));

        put(getAPIURL(this.props.project, "owner"), res.username).then(result => {
            if (result.type === "success") {
                this.props.onChange(this.props.owner, res.username);
                this.setState(state => ({
                    ...state,
                    loading: undefined
                }));
            } else {
                this.setState(state => ({
                    ...state,
                    loading: result
                }));
            }
        });
        return false;
    }

    render() {
        return <div>
            <h2>Owner</h2>
            <UserItem username={this.props.owner} />
            {this.props.isOwner && <form onSubmit={evt => this.transferOwnership(evt)}><input disabled={this.state.loading === true} name="username" placeholder="New owner" /><input disabled={this.state.loading === true} type="submit" value="Transfer ownership" /></form> }
            {this.state.loading !== true && this.state.loading != null ? JSON.stringify(this.state.loading) : ""}
        </div>;
    }
}

class ProjectDevelopers extends React.Component<{
    project: ProjectName;
    isOwner: boolean;
    members: ProjectMember[];
    onChange: (members: ProjectMember[]) => void;
}, LoadingState> {
    state: LoadingState = {};
    addUser(evt: React.FormEvent<HTMLFormElement>) {
        evt.preventDefault();

        const el = evt.currentTarget.elements;

        const res = {
            username: (el.namedItem("username") as HTMLInputElement).value,
            make_branches: (el.namedItem("make_branches") as HTMLInputElement).checked,
            make_subprojects: (el.namedItem("make_subprojects") as HTMLInputElement).checked,
            make_tags: (el.namedItem("make_tags") as HTMLInputElement).checked,
            delete_tags: (el.namedItem("delete_tags") as HTMLInputElement).checked,
        };

        post(getAPIURL(this.props.project, "members"), res).then(result => {
            if (result.type === "success") {
                this.setState({
                    loading: undefined,
                });
                this.props.onChange([...this.props.members, res]);
            } else {
                this.setState({
                    loading: result,
                });
            }
        });
        this.setState({
            loading: true,
        });
        return false;
    }

    render() {
        return <div>
            <h2>Developers</h2>
            {
                (!this.props.isOwner && this.props.members.length === 0) ? <div>No other developers</div> : <div>
                    {this.props.members.map(x => <ProjectDeveloper key={x.username} project={this.props.project} member={x} isOwner={this.props.isOwner} onChange={m => {
                        this.props.onChange(this.props.members.map(x => {
                            if (x.username === m.username) {
                                return m;
                            }
                            return x;
                        }));
                    }} onDelete={m => this.props.onChange(this.props.members.filter(x => x.username !== m.username))} />)}
                    {this.props.isOwner && <form onSubmit={evt => this.addUser(evt)}>
                        <input name="username" placeholder="Username"></input>
                        {" "}Make branches: <input name="make_branches" type="checkbox"></input>
                        {" "}Make subprojects: <input name="make_subprojects" type="checkbox"></input>
                        {" "}Make tags: <input name="make_tags" type="checkbox"></input>
                        {" "}Delete tags: <input name="delete_tags" type="checkbox"></input>
                        <input type="submit" value="Add user"></input>
                    </form>}
                </div>
            }
            {this.state.loading !== true && this.state.loading != null ? JSON.stringify(this.state.loading) : ""}
        </div>;
    }
}

class ProjectDeveloper extends React.Component<{
    project: ProjectName;
    isOwner: boolean;
    member: ProjectMember;
    onChange: (dev: ProjectMember) => void;
    onDelete: (dev: ProjectMember) => void;
}, LoadingState> {
    state: LoadingState = {};

    setUser(evt: React.ChangeEvent<HTMLInputElement>, key: "make_branches" | "make_subprojects" | "make_tags" | "delete_tags") {
        evt.preventDefault();
        const m = this.props.member;
        const res = {
            make_branches: m.make_branches,
            make_subprojects: m.make_subprojects,
            make_tags: m.make_tags,
            delete_tags: m.delete_tags,
        };
        res[key] = evt.currentTarget.checked;
        put(getAPIURL(this.props.project, "members", m.username), res).then(result => {
            if (result.type === "success") {
                this.setState({
                    loading: undefined
                });
                this.props.onChange({
                    username: m.username,
                    ...res
                });
            } else {
                this.setState({
                    loading: result
                });
            }
        });
        this.setState({
            loading: true
        });
        return false;
    }

    delUser() {
        const m = this.props.member;
        del(getAPIURL(this.props.project, "members", m.username)).then(result => {
            if (result.type === "success") {
                this.setState({
                    loading: undefined
                });
                this.props.onDelete(m);
            } else {
                this.setState({
                    loading: result
                });
            }
        });
        this.setState({
            loading: true
        });
    }
    
    render() {
        const m = this.props.member;
        const disable = this.state.loading === true || !this.props.isOwner;
        return <>
            <UserItem key={m.username} username={m.username} />
            Make branches: <input onChange={evt => this.setUser(evt, "make_branches")} checked={m.make_branches} disabled={disable} type="checkbox" />
            Make subprojects: <input onChange={evt => this.setUser(evt, "make_subprojects")} checked={m.make_subprojects} disabled={disable} type="checkbox" />
            Make tags: <input onChange={evt => this.setUser(evt, "make_tags")} checked={m.make_tags} disabled={disable} type="checkbox" />
            Delete tags: <input onChange={evt => this.setUser(evt, "delete_tags")} checked={m.delete_tags} disabled={disable} type="checkbox" />
            {this.props.isOwner ? (
                <>
                    <button onClick={() => this.delUser()} disabled={disable}>Remove</button>
                    {this.state.loading != null && this.state.loading !== true ? <>Errors occured: {JSON.stringify(this.state.loading)}</> : <></>}
                </>
             ) : <></>}
        </>;
    }
}