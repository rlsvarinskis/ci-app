import { User } from 'App';
import Navbar from 'components/navbar';
import { ProfileItem } from 'components/navbar/item';
import Page from 'components/page';
import React from 'react';
import { Link } from 'react-router-dom';
import { SSHKeys } from './ssh_keys';

interface UserProps {
    user: User;
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
    editingSSH: boolean;
    error: any;
};

export default class UserPage extends React.Component<UserProps, UserState> {
    state: UserState = {
        loading: 1,
        user: null,
        error: null,
        editingSSH: false,
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

        var sshKeys: JSX.Element;
        if (!this.state.editingSSH) {
            sshKeys = <button onClick={() => this.setState(state => ({...state, editingSSH: true}))}>Edit SSH keys</button>;
        } else {
            sshKeys = <SSHKeys target={this.props.target}></SSHKeys>
        }

        return <>
            <Navbar user={this.props.user}><ProfileItem path={"/users/" + this.props.target}>{this.props.target}</ProfileItem></Navbar>
            <Page>
                <h1>{this.props.target}</h1>
                <img src={"/api/users/" + this.props.target + "/avatar"}></img>
                {this.props.target === this.props.user?.username ? <><p>Email: {this.props.user.email}</p>{sshKeys}</> : <></>}
                {projects}
            </Page>
        </>;
    }
};
