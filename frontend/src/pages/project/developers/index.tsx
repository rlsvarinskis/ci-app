import React from 'react';
import { ProjectMember } from 'components/projectlist';
import page from 'pages/project/page/page.less';
import ProjectSidebar from 'components/projectsidebar';
import Navbar from 'components/navbar';
import { DevelopersItem } from 'components/navbar/item';
import { getAPIURL, getBaseURL, LoadingState, ProjectName, ProjectNavbarItems, ProjectPageProps } from '../common';
import { FailResponses, post, put, request } from 'utils/xhr';
import { DataProvider, ProjectInfo } from '../providers';
import ErrorPage from 'pages/error';
import { ProjectDevelopers } from './developers';

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

interface OwnerProps {
    project: ProjectName;
    owner: string;
    isOwner: boolean;
    onChange: (oldOwner: string, newOwner: string) => void;
};

export class Owner extends React.Component<OwnerProps, LoadingState> {
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
            <div><img src={"/api/users/" + this.props.owner + "/avatar"} /><h4>{this.props.owner}</h4></div>
            {this.props.isOwner && <form onSubmit={evt => this.transferOwnership(evt)}><input disabled={this.state.loading === true} name="username" placeholder="New owner" /><input disabled={this.state.loading === true} type="submit" value="Transfer ownership" /></form> }
            {this.state.loading !== true && this.state.loading != null ? JSON.stringify(this.state.loading) : ""}
        </div>;
    }
}