import React from 'react';
import { getAPIURL, getBaseURL, LoadingState, ProjectName, ProjectNavbarItems, ProjectPageProps } from '../common';
import Navbar from 'components/navbar';
import ProjectSidebar from 'components/sidebar';
import page from 'pages/project/page/page.less';
import { BranchesItem } from 'components/navbar/item';
import { del, FailResponses, post, put, request } from 'utils/xhr';
import { DataProvider } from '../providers';
import ErrorPage from 'pages/error';
import { User } from 'App';
import { BranchPermissions, BranchPermissionsText } from 'components/projectmaker';

export default class ProjectBranchesPage extends React.Component<ProjectPageProps> {
    render() {
        return <>
            <Navbar user={this.props.user}><ProjectNavbarItems project={this.props.project} /><BranchesItem path={getBaseURL(this.props.project, "branches")}>Branches</BranchesItem></Navbar>
            <ProjectSidebar baseurl={getBaseURL(this.props.project)} active="branches"></ProjectSidebar>
            <div className={page.content + " " + page.mini}>
                <div className={page.page}>
                    <ProjectBranchesList project={this.props.project} user={this.props.user} />
                </div>
            </div>
        </>
    }
}

interface ProjectBranchesData {
    branches: {[key: string]: Branch};
};

class ProjectBranchesList extends DataProvider<ProjectBranchesData> {
    update() {
        return {
            branches: request<{[key: string]: Branch}>("GET", getAPIURL(this.props.project, "branches"))
        };
    }

    replaceBranch(branch: Branch) {
        this.setState(state => {
            if (state.data === "loading" || "error" in state.data) {
                return state;
            }

            const data = state.data.data;
            const newData = {
                ...data,
                branches: {
                    ...data.branches,
                    [branch.name]: branch
                }
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
        return <ErrorPage error={error} />;
    }

    renderSuccess(data: ProjectBranchesData) {
        const branches = data.branches;
        const list = Object.keys(branches);
        return <>
            {list.map(branch => <ProjectBranch key={branch} project={this.props.project} user={this.props.user} branch={branches[branch]} onUpdate={branch => this.replaceBranch(branch)} />)}
        </>;
    }
}

interface BranchSettingsState {
    error: FailResponses | null;
};

export interface Branch {
    name: string;
    default_permission: "NONE" | "READ" | "WRITE";
    owner: string;
    users: BranchUser[];
};

export interface BranchUser {
    username: string;
    writable: boolean;
}

class ProjectBranch extends React.Component<{
    project: ProjectName;
    user: User;
    branch: Branch;
    onUpdate: (branch: Branch) => void;
}, BranchSettingsState> {
    state: BranchSettingsState = {
        error: null
    };

    addUser(evt: React.FormEvent<HTMLFormElement>) {
        evt.preventDefault();

        const el = evt.currentTarget.elements;

        const res = {
            username: (el.namedItem("username") as HTMLInputElement).value,
            writable: (el.namedItem("writable") as HTMLInputElement).checked,
        };

        post(getAPIURL(this.props.project, "branches", this.props.branch.name, "members"), res).then(result => {
            if (result.type === "success") {
                const newBranch = {
                    ...this.props.branch,
                    users: [...this.props.branch.users, res]
                };
                this.props.onUpdate(newBranch);
            } else {
                this.setState({
                    error: result,
                });
            }
        });
        return false;
    }

    setDefaultBP(evt: React.ChangeEvent<HTMLSelectElement>) {
        evt.preventDefault();
        const val = evt.currentTarget.value as "NONE" | "READ" | "WRITE";
        put(getAPIURL(this.props.project, "branches", this.props.branch.name, "permission"), val).then(result => {
            if (result.type === "success") {
                this.setState(state => {
                    const newBranch = {
                        ...this.props.branch,
                        default_permission: val
                    };
                    this.props.onUpdate(newBranch);
                });
            } else {
                this.setState({
                    error: result
                });
            }
        });
        return false;
    }

    updateBranchUser(u: BranchUser) {
        this.props.onUpdate({
            ...this.props.branch,
            users: this.props.branch.users.map(x => {
                if (x.username === u.username) {
                    return u;
                }
                return x;
            })
        });
    }

    removeBranchUser(u: BranchUser) {
        this.props.onUpdate({
            ...this.props.branch,
            users: this.props.branch.users.filter(x => x.username !== u.username)
        });
    }

    render() {
        const branch = this.props.branch;
        return <div>
            <h2>{branch.name}</h2>
            <div>Default permission: <select disabled={branch.owner !== this.props.user.username} onChange={evt => this.setDefaultBP(evt)} value={branch.default_permission}>{BranchPermissions.map(x => <option key={x} value={x}>{BranchPermissionsText[x]}</option>)}</select></div>
            {branch.users.map(u => <ProjectBranchUser key={u.username} project={this.props.project} user={this.props.user} branch={this.props.branch} branchUser={u} onUpdate={u => this.updateBranchUser(u)} onDelete={u => this.removeBranchUser(u)} />)}
            {branch.owner === this.props.user.username && <form onSubmit={evt => this.addUser(evt)}>
                <input name="username" placeholder="Username" />
                {" "}Can write: <input name="writable" type="checkbox" />
                <input type="submit" value="Add user" />
            </form>}
        </div>;
    }
}

class ProjectBranchUser extends React.Component<{
    project: ProjectName;
    user: User;
    branch: Branch;
    branchUser: BranchUser;
    onUpdate: (user: BranchUser) => void;
    onDelete: (user: BranchUser) => void;
}, LoadingState> {
    state: LoadingState = {};

    setCanWrite(evt: React.ChangeEvent<HTMLInputElement>) {
        evt.preventDefault();
        const u = this.props.branchUser;
        const val = evt.currentTarget.checked;
        put(getAPIURL(this.props.project, "branches", this.props.branch.name, "member", u.username), val).then(result => {
            if (result.type === "success") {
                this.setState({
                    loading: undefined
                });
                this.props.onUpdate({
                    ...u,
                    writable: val
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
        const u = this.props.branchUser;
        del(getAPIURL(this.props.project, "branches", this.props.branch.name, "member", u.username)).then(result => {
            if (result.type === "success") {
                this.setState({
                    loading: undefined
                });
                this.props.onDelete(u);
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
        const owner = this.props.user.username === this.props.branch.owner;
        const disabled = this.state.loading === true || !owner;
        return <div>
            {this.props.branchUser.username} Can write: <input type="checkbox" onChange={evt => this.setCanWrite(evt)} checked={this.props.branchUser.writable} disabled={disabled} />
            {owner && <button onClick={() => this.delUser()} disabled={disabled}>Remove</button>}
        </div>;
    }
}