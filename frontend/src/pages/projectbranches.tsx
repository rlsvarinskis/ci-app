import { User } from 'App';
import React from 'react';
import { ProjectMember } from 'components/projectlist';
import Page from 'components/page';
import { Link } from 'react-router-dom';
import { BranchPermissions, BranchPermissionsText } from 'components/projectmaker';

interface ProjectMainPageProps {
    parent: string[];
    project: string;
    user: User;
};

interface Branch {
    name: string;
    default_permission: "NONE" | "READ" | "WRITE";
    owner: string;
    users: BranchUser[];
};

interface BranchUser {
    username: string;
    writable: boolean;
}

interface ProjectMainPageState {
    branches: {[key: string]: Branch};
    error: any;
};

export default class ProjectBranchesPage extends React.Component<ProjectMainPageProps, ProjectMainPageState> {
    state: ProjectMainPageState = {
        branches: {},
        error: null,
    };

    constructor(props: ProjectMainPageProps) {
        super(props);
        this.loadBranches();
    }

    loadBranches() {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "/api/projects/" + this.props.parent.map(x => x + "/sub/").join("") + this.props.project + "/branches");
        xhr.responseType = "json";
        xhr.onreadystatechange = evt => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    this.setState(state => ({
                        ...state,
                        branches: xhr.response.data,
                    }));
                } else {
                    this.setState(state => ({
                        ...state,
                        branches: {},
                        error: xhr.response,
                    }))
                }
            }
        };
        xhr.send();
    }

    addUser(evt: React.FormEvent<HTMLFormElement>, branch: Branch) {
        evt.preventDefault();

        const el = evt.currentTarget.elements;

        const res = {
            username: (el.namedItem("username") as HTMLInputElement).value,
            writable: (el.namedItem("writable") as HTMLInputElement).checked,
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/projects/" + this.props.parent.map(x => x + "/sub/").join("") + this.props.project + "/branches/" + branch.name + "/members");
        xhr.setRequestHeader("Content-type", "application/json");
        xhr.onreadystatechange = evt => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    this.setState(state => {
                        var nBranches = state.branches;
                        branch.users.push(res);
                        nBranches[branch.name] = branch;
                        return {
                            ...state,
                            error: null,
                            branches: nBranches,
                        };
                    });
                } else {
                    this.setState(state => ({
                        ...state,
                        error: xhr.response.message,
                    }))
                }
            }
        };
        xhr.send(JSON.stringify(res));
        return false;
    }

    setCanWrite(evt: React.MouseEvent<HTMLInputElement>, b: Branch, u: BranchUser) {
        evt.preventDefault();
        const val = evt.currentTarget.checked;
        var xhr = new XMLHttpRequest();
        xhr.open("PUT", "/api/projects/" + this.props.parent.map(x => x + "/sub/").join("") + this.props.project + "/branches/" + b.name + "/member/" + u.username);
        xhr.setRequestHeader("Content-type", "application/json");
        xhr.onreadystatechange = evt => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    this.setState(state => {
                        const newBranches = state.branches;
                        newBranches[b.name] = {
                            ...b,
                            users: b.users.map(x => {
                                if (x.username === u.username) {
                                    x.writable = u.writable;
                                }
                                return x;
                            }),
                        };
                        return {
                            ...state,
                            branches: newBranches,
                            error: null,
                        };
                    });
                } else {
                    this.setState(state => ({
                        ...state,
                        error: xhr.response.message,
                    }))
                }
            }
        };
        xhr.send(JSON.stringify(val));
        return false;
    }

    delUser(b: Branch, u: BranchUser) {
        var xhr = new XMLHttpRequest();
        xhr.open("DELETE", "/api/projects/" + this.props.parent.map(x => x + "/sub/").join("") + this.props.project + "/branches/" + b.name + "/member/" + u.username);
        xhr.onreadystatechange = evt => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    this.setState(state => {
                        const newBranches = state.branches;
                        newBranches[b.name] = {
                            ...b,
                            users: b.users.filter(x => x.username !== u.username),
                        };
                        return {
                            ...state,
                            branches: newBranches,
                            error: null,
                        };
                    });
                } else {
                    this.setState(state => ({
                        ...state,
                        error: xhr.response.message,
                    }))
                }
            }
        };
        xhr.send();
    }

    setDefaultBP(evt: React.ChangeEvent<HTMLSelectElement>, b: Branch) {
        evt.preventDefault();
        const val = evt.currentTarget.value as "NONE" | "READ" | "WRITE";
        var xhr = new XMLHttpRequest();
        xhr.open("PUT", "/api/projects/" + this.props.parent.map(x => x + "/sub/").join("") + this.props.project + "/branches/" + b.name + "/permission");
        xhr.setRequestHeader("Content-type", "application/json");
        xhr.onreadystatechange = evt => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    this.setState(state => {
                        const newBranches = state.branches;
                        newBranches[b.name] = {
                            ...b,
                            default_permission: val,
                        };
                        return {
                            ...state,
                            branches: newBranches,
                            error: null,
                        };
                    });
                } else {
                    this.setState(state => ({
                        ...state,
                        error: xhr.response.message,
                    }))
                }
            }
        };
        xhr.send(JSON.stringify(val));
        return false;
    }

    render() {
        if (this.state.error != null) {
            if (this.state.error.type === "forbidden") {
                return <Page><h1>Forbidden</h1></Page>
            } else if (this.state.error.type === "not_found") {
                return <Page><h1>Not found</h1></Page>
            }
        }
        const allBranches = Object.keys(this.state.branches);
        return <Page>
            <h1>Branches</h1>
            {
                allBranches.map(x => this.state.branches[x]).map(x => <div>
                    <h2>{x.name}</h2>
                    {x.owner === this.props.user.username ? <p>Default permission: <select onChange={evt => this.setDefaultBP(evt, x)} value={x.default_permission}>{BranchPermissions.map(x => <option value={x}>{BranchPermissionsText[x]}</option>)}</select></p> : <></>}
                    {
                        x.users.map(u => <p>{u.username} Can write: <input type="checkbox" onClick={evt => this.setCanWrite(evt, x, u)} checked={u.writable}></input><button onClick={() => this.delUser(x, u)}>Remove</button></p>)
                    }
                    {x.owner === this.props.user.username && <form onSubmit={evt => this.addUser(evt, x)}>
                        <input name="username" placeholder="Username"></input>
                        {" "}Can write: <input name="writable" type="checkbox"></input>
                        <input type="submit" value="Add user"></input>
                    </form>}
                </div>)
            }
        </Page>
    }
};