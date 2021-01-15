import { User } from 'App';
import Page from 'components/page';
import React from 'react';
import { Link } from 'react-router-dom';
import ProjectMaker from './projectmaker';

interface ProjectInfo {
    id: number;
    name: string;
    description: string;
};

interface ProjectListProp {
    parent: string[];
    user: User;
};

interface ProjectListState {
    projects: ProjectInfo[];
    loading: boolean;
    errors: any;
    canMake: boolean;
    canMakeError: any;
    isMaking: boolean;
};

export interface ProjectMember {
    username: string;
    make_branches: boolean;
    make_subprojects: boolean;
    make_tags: boolean;
    delete_tags: boolean;
};

export default class ProjectList extends React.Component<ProjectListProp, ProjectListState> {
    state: ProjectListState = {
        projects: [],
        loading: true,
        errors: null,
        canMake: false,
        canMakeError: null,
        isMaking: false,
    };

    constructor(props: ProjectListProp) {
        super(props);
        this.loadMore();
        if (this.props.user.username === "") {
        } else if (this.props.parent.length === 0) {
            this.state.canMake = true;
        } else {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "/api/projects" + this.props.parent.map(x => "/" + x + "/").join("sub") + "members");
            xhr.responseType = "json";
            xhr.onreadystatechange = evt => {
                if (xhr.readyState === XMLHttpRequest.DONE) {
                    if (xhr.status === 200) {
                        const resp: ProjectMember[] = xhr.response.data;
                        const me = resp.find(x => x.username === this.props.user.username);
                        if (me == null || !me.make_subprojects) {
                        } else {
                            this.setState({
                                canMake: true,
                            });
                        }
                    } else {
                        this.setState({
                            canMakeError: xhr.response,
                        });
                    }
                }
            }
            xhr.send();
            this.findOwner();
        }
    }

    findOwner() {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "/api/projects" + this.props.parent.map(x => "/" + x + "/").join("sub") + "");
        xhr.responseType = "json";
        xhr.onreadystatechange = evt => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    if (xhr.response.data.owner === this.props.user.username) {
                        this.setState({
                            canMake: true,
                        });
                    }
                } else {
                    this.setState({
                        canMakeError: xhr.response,
                    });
                }
            }
        }
        xhr.send();
    }

    loadMore() {
        var query: string = "";
        if (this.state.projects.length > 0) {
            query = "?after=" + encodeURIComponent(this.state.projects[this.state.projects.length - 1].name);
        }
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "/api/projects/" + this.props.parent.map(x => x + "/sub/").join("") + query);
        xhr.responseType = "json";
        xhr.onreadystatechange = evt => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    const resp: ProjectInfo[] = xhr.response.data;

                    this.setState(state => ({
                        ...state,
                        loading: false,
                        projects: [...state.projects, ...resp],
                    }));
                } else {
                    this.setState({
                        loading: false,
                        errors: xhr.response,
                    });
                }
            }
        }
        if (!this.state.loading) {
            this.setState({
                loading: true,
            });
        }
        xhr.send();
    }

    render() {
        const rootUrl = "/p/" + this.props.parent.map(x => x + "/_/").join("");

        return <Page>
            {this.state.isMaking ? <ProjectMaker parent={this.props.parent} onClose={() => this.setState({isMaking: false})}></ProjectMaker> : <></>}
            <button onClick={() => this.setState({isMaking: true})} disabled={!this.state.canMake}>Create a project</button>
            {...this.state.projects.map(project => {
                return <Link key={project.name} to={rootUrl + project.name}>
                    <div className="project">
                        <h1>{project.name}</h1>
                        <p>{project.description}</p>
                    </div>
                </Link>;
            })}
            {this.state.errors != null ? JSON.stringify(this.state.errors) : ""}
            <button disabled={this.state.loading} onClick={() => this.loadMore()}>Load more</button>
        </Page>;
    }
}