import React from 'react';
import { FailResponses, request } from 'utils/xhr';

interface SSHKeysProps {
    target: string;
};

interface SSHKey {
    id: number;
    algorithm: string,
    key: string;
    comment: string;
    deleting?: true;
};

interface SSHKeysState {
    keys: SSHKey[];
    loading: number;
    error: FailResponses | null;
    addingSSH: boolean;
};

export class SSHKeys extends React.Component<SSHKeysProps, SSHKeysState> {
    state: SSHKeysState = {
        keys: [],
        loading: 1,
        error: null,
        addingSSH: false,
    };

    componentDidMount() {
        request<SSHKey[]>("GET", "/api/users/" + this.props.target + "/keys").then(result => {
            if (result.type === "success") {
                this.setState(state => ({
                    ...state,
                    loading: state.loading - 1,
                    keys: result.data,
                }));
            } else {
                this.setState(state => ({
                    ...state,
                    loading: state.loading - 1,
                    error: result,
                }));
            }
        });
    }

    deleteKey(id: number) {
        this.setState(state => ({
            ...state,
            loading: state.loading + 1,
            keys: state.keys.map(x => {
                if (x.id === id) {
                    x.deleting = true;
                }
                return x;
            }),
        }));
        request("DELETE", "/api/users/" + this.props.target + "/keys/" + id).then(result => {
            if (result.type === "success") {
                this.setState(state => ({
                    ...state,
                    loading: state.loading - 1,
                    keys: state.keys.filter(x => x.id !== id),
                }));
            } else {
                this.setState(state => ({
                    ...state,
                    loading: state.loading - 1,
                    error: result,
                    keys: state.keys.map(x => {
                        if (x.id === id) {
                            x.deleting = undefined;
                        }
                        return x;
                    }),
                }));
            }
        });    
    }

    addKey(evt: React.FormEvent<HTMLFormElement>) {
        evt.preventDefault();
        const data = (evt.currentTarget.elements.namedItem("sshkey") as HTMLInputElement).value.trim().split(/\s+/, 3);
        if (data.length < 2) {
            this.setState(state => ({
                ...state,
                error: {
                    type: "failed",
                    code: 0,
                    result: "invalid_request",
                    message: "Invalid SSH key format",
                },
            }));
            return;
        } else if (data.length === 2) {
            data.push("");
        }
        const newKey = {
            algorithm: data[0],
            key: data[1],
            comment: data[2],
        };

        this.setState(state => ({
            ...state,
            loading: state.loading + 1,
            error: null,
            addingSSH: true,
        }));
        request<number>("POST", "/api/users/" + this.props.target + "/keys", JSON.stringify(newKey), {"Content-type": "application/json"}).then(result => {
            if (result.type === "success") {
                this.setState(state => ({
                    ...state,
                    loading: state.loading - 1,
                    keys: [...state.keys, {
                        ...newKey,
                        id: result.data,
                    }],
                    addingSSH: false,
                }));
            } else {
                this.setState(state => ({
                    ...state,
                    loading: state.loading - 1,
                    error: result,
                    addingSSH: false,
                }));
            }
        });
        return false;
    }
    
    render() {
        return <>
            <button disabled={this.state.loading > 0} onClick={() => this.setState(state => ({...state, editingSSH: false, error: null}))}>Done</button>
            {...this.state.keys.map(x => (
                <React.Fragment key={x.algorithm + " " + x.key}>
                    <p>
                        {x.algorithm + " " + x.key + " " + x.comment}
                        <button onClick={() => this.deleteKey(x.id)} disabled={x.deleting === true}>Delete</button>
                    </p>
                </React.Fragment>
            ))}
            <form onSubmit={evt => this.addKey(evt)}>
                <input name="sshkey" placeholder="SSH Key goes here..." value={this.state.addingSSH ? "" : undefined} disabled={this.state.addingSSH}></input>
                <input type="submit" value="Add" disabled={this.state.addingSSH}></input>
            </form>
            {this.state.error != null ? this.state.error.type === "failed" ? "Failed to add SSH key: " + this.state.error.message : this.state.error.error.toString() : ""}
        </>;
    }
}