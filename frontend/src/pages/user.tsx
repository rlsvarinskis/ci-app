import { User } from 'App';
import Page from 'components/page';
import React from 'react';
import { Link } from 'react-router-dom';

interface UserProps {
    user: User | null;
    target: string;
};

interface UserProject {
    id: number;
    name: string;
    private: boolean;
};

interface UserState {
    loading: number;
    user: {
        projects: {
            public: UserProject[];
            common: UserProject[];
        };
    } | null;
    userSSHKeys: {
        id: number;
        algorithm: string,
        key: string;
        comment: string;
        deleting?: boolean;
    }[];
    error: any;
    editingSSH: boolean;
    sshLoading: number;
    sshError: any;
    addingSSH: boolean;
};

export default class UserPage extends React.Component<UserProps, UserState> {
    state: UserState = {
        loading: 1,
        user: null,
        error: null,
        userSSHKeys: [],
        editingSSH: false,
        sshLoading: 0,
        sshError: null,
        addingSSH: false,
    };

    constructor(props: UserProps) {
        super(props);
        var xhr1 = new XMLHttpRequest();
        xhr1.open("GET", "/api/users/" + props.target + "/projects");
        xhr1.responseType = "json";
        xhr1.onreadystatechange = evt => {
            if (xhr1.readyState === XMLHttpRequest.DONE) {
                if (xhr1.status === 200) {
                    var p: UserProject[] = xhr1.response.data.public;
                    var c: UserProject[] = xhr1.response.data.common;
                    var x = new Set<number>();
                    c.forEach(v => x.add(v.id));
                    p = p.filter(v => !x.has(v.id));
                    this.setState(state => ({
                        ...state,
                        loading: state.loading - 1,
                        user: {
                            projects: {
                                public: p,
                                common: c,
                            },
                        },
                    }));
                } else {
                    this.setState(state => ({
                        ...state,
                        loading: state.loading - 1,
                        error: xhr1.response,
                    }));
                }
            }
        };
        xhr1.send();
        if (props.target === props.user?.username) {
            var xhr2 = new XMLHttpRequest();
            xhr2.open("GET", "/api/users/" + props.target + "/keys");
            xhr2.responseType = "json";
            xhr2.onreadystatechange = evt => {
                if (xhr2.readyState === XMLHttpRequest.DONE) {
                    if (xhr2.status === 200) {
                        this.setState(state => ({
                            ...state,
                            loading: state.loading - 1,
                            userSSHKeys: xhr2.response.data,
                        }));
                    } else {
                        this.setState(state => ({
                            ...state,
                            loading: state.loading - 1,
                            error: xhr2.response,
                        }));
                    }
                }
            };
            xhr2.send();
            this.state.loading++;
        }
    }

    render() {
        if (this.state.loading > 0) {
            return <Page>
                <h1>Loading...</h1>
            </Page>
        }

        if (this.state.error) {
            return <Page>
                <h1>{this.state.error.message}</h1>
            </Page>
        } else if (this.state.user == null) {
            return <Page>
                <h1>An unexpected error occured</h1>
            </Page>
        }

        const hasProjects = this.state.user.projects.common.length + this.state.user.projects.public.length > 0;

        var projects: JSX.Element;
        if (!hasProjects) {
            projects = <div>
                <h2>Projects</h2>
                <p>This user has no projects that you can see!</p>
            </div>;
        } else {
            projects = <div>
                {this.state.user.projects.common.length > 0 ? <><h2>{this.props.target === this.props.user?.username ? "Projects" : "Common projects"}</h2>{
                    this.state.user.projects.common.map(x => <Link to={"/p/" + x.id}><div><h3>{x.name}</h3></div></Link>)
                }</> : <></>}
                {this.state.user.projects.public.length > 0 ? <><h2>Other projects</h2>{
                    this.state.user.projects.public.map(x => <Link to={"/p/" + x.id}><div><h3>{x.name}</h3></div></Link>)
                }</> : <></>}
            </div>;
        }

        const deleteKey = (id: number) => {
            var xhr2 = new XMLHttpRequest();
            xhr2.open("DELETE", "/api/users/" + this.props.target + "/keys/" + id);
            xhr2.responseType = "json";
            xhr2.onreadystatechange = evt => {
                if (xhr2.readyState === XMLHttpRequest.DONE) {
                    if (xhr2.status === 200) {
                        this.setState(state => ({
                            ...state,
                            sshLoading: state.sshLoading - 1,
                            userSSHKeys: state.userSSHKeys.filter(x => x.id !== id),
                        }));
                    } else {
                        this.setState(state => ({
                            ...state,
                            sshLoading: state.sshLoading - 1,
                            sshError: xhr2.response,
                            userSSHKeys: state.userSSHKeys.map(x => {
                                if (x.id === id) {
                                    x.deleting = undefined;
                                }
                                return x;
                            }),
                        }));
                    }
                }
            };
            this.setState(state => ({
                ...state,
                sshLoading: state.sshLoading + 1,
                sshError: null,
                userSSHKeys: state.userSSHKeys.map(x => {
                    if (x.id === id) {
                        x.deleting = true;
                    }
                    return x;
                }),
            }));
            xhr2.send();
        }

        const addKey = (evt: React.FormEvent<HTMLFormElement>) => {
            evt.preventDefault();
            const data = (evt.currentTarget.elements.namedItem("sshkey") as HTMLInputElement).value.trim().split(/\s+/, 3);
            if (data.length < 2) {
                this.setState(state => ({
                    ...state,
                    sshError: {
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
            var xhr2 = new XMLHttpRequest();
            xhr2.open("POST", "/api/users/" + this.props.target + "/keys");
            xhr2.responseType = "json";
            xhr2.setRequestHeader("Content-type", "application/json");
            xhr2.onreadystatechange = evt => {
                if (xhr2.readyState === XMLHttpRequest.DONE) {
                    if (xhr2.status === 200) {
                        this.setState(state => ({
                            ...state,
                            sshLoading: state.sshLoading - 1,
                            userSSHKeys: [...state.userSSHKeys, {
                                ...newKey,
                                id: xhr2.response.data,
                            }],
                            addingSSH: false,
                        }));
                    } else {
                        this.setState(state => ({
                            ...state,
                            sshLoading: state.sshLoading - 1,
                            sshError: xhr2.response,
                            addingSSH: false,
                        }));
                    }
                }
            };
            this.setState(state => ({
                ...state,
                sshLoading: state.sshLoading + 1,
                sshError: null,
                addingSSH: true,
            }));
            xhr2.send(JSON.stringify(newKey));
            return false;
        }

        var sshKeys: JSX.Element;
        if (!this.state.editingSSH) {
            sshKeys = <>
                <button onClick={() => this.setState(state => ({...state, editingSSH: true}))}>Edit SSH keys</button>
            </>;
        } else {
            sshKeys = <>
                <button disabled={this.state.sshLoading > 0} onClick={() => this.setState(state => ({...state, editingSSH: false, sshError: null}))}>Done</button>
                {...this.state.userSSHKeys.map(x => <React.Fragment key={x.algorithm + " " + x.key}><p>{x.algorithm + " " + x.key + " " + x.comment}<button onClick={() => deleteKey(x.id)} disabled={x.deleting}>Delete</button></p></React.Fragment>)}
                <form onSubmit={evt => addKey(evt)}>
                    <input name="sshkey" placeholder="SSH Key goes here..." value={this.state.addingSSH ? "" : undefined} disabled={this.state.addingSSH}></input>
                    <input type="submit" value="Add" disabled={this.state.addingSSH}></input>
                </form>
                {this.state.sshError != null ? this.state.sshError.message : ""}
            </>
        }

        return <Page>
            <h1>{this.props.target}</h1>
            <img src={"/api/users/" + this.props.target + "/avatar"}></img>
            {this.props.target === this.props.user?.username ? <><p>Email: {this.props.user.email}</p>{sshKeys}</> : <></>}
            {projects}
        </Page>;
    }
};
