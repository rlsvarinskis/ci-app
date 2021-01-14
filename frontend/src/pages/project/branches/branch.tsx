import { BranchPermissions, BranchPermissionsText } from 'components/projectmaker';
import React from 'react';
import { del, FailResponses, post, put, request } from 'utils/xhr';
import { getAPIURL, ProjectPageProps } from '../common';

interface BranchSettingsProps extends ProjectPageProps {
    branch: Branch;
    onUpdate: (branch: Branch) => void;
};

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

export class BranchSettings extends React.Component<BranchSettingsProps, BranchSettingsState> {
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

    setCanWrite(evt: React.MouseEvent<HTMLInputElement>, u: BranchUser) {
        evt.preventDefault();
        const val = evt.currentTarget.checked;
        put(getAPIURL(this.props.project, "branches", this.props.branch.name, "member", u.username), val).then(result => {
            if (result.type === "success") {
                const newBranch = {
                    ...this.props.branch,
                    users: this.props.branch.users.map(x => {
                        if (x.username === u.username) {
                            x = {...x, writable: val};
                        }
                        return x;
                    })
                };
                this.props.onUpdate(newBranch);
            } else {
                this.setState({
                    error: result
                });
            }
        })
        return false;
    }

    delUser(u: BranchUser) {
        del(getAPIURL(this.props.project, "branches", this.props.branch.name, "member", u.username)).then(result => {
            if (result.type === "success") {
                const newBranch = {
                    ...this.props.branch,
                    users: this.props.branch.users.filter(x => x.username !== u.username)
                };
                this.props.onUpdate(newBranch);
            } else {
                this.setState({
                    error: result
                });
            }
        });
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

    render() {
        const branch = this.props.branch;
        return <div>
            <h2>{branch.name}</h2>
            <div>Default permission: <select disabled={branch.owner !== this.props.user.username} onChange={evt => this.setDefaultBP(evt)} value={branch.default_permission}>{BranchPermissions.map(x => <option key={x} value={x}>{BranchPermissionsText[x]}</option>)}</select></div>
            {
                branch.users.map(u => <p>{u.username} Can write: <input type="checkbox" onClick={evt => this.setCanWrite(evt, u)} checked={u.writable}></input><button onClick={() => this.delUser(u)}>Remove</button></p>)
            }
            {branch.owner === this.props.user.username && <form onSubmit={evt => this.addUser(evt)}>
                <input name="username" placeholder="Username"></input>
                {" "}Can write: <input name="writable" type="checkbox"></input>
                <input type="submit" value="Add user"></input>
            </form>}
        </div>;
    }
}