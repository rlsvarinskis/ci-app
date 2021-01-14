import React from 'react';
import { User } from "App";
import { ProjectItem } from "components/navbar/item";
import { FailResponses } from 'utils/xhr';

export interface ProjectName {
    parent: string[];
    project: string;
}

export interface ProjectPageProps {
    project: ProjectName;
    user: User;
};

export interface LoadingState {
    loading?: true | FailResponses;
};

export class ProjectNavbarItems extends React.Component<{project: ProjectName}> {
    render() {
        const navbarItems = this.props.project.parent.reduce((a, c) => {
            const target = a.parent + "/" + c;
    
            a.parent = target + "/_";
            a.acc.push(<ProjectItem key={target} path={target}>{c}</ProjectItem>);
    
            return a;
        }, {parent: "/p", acc: [] as JSX.Element[]});
        navbarItems.acc.push(<ProjectItem key={navbarItems.parent + "/" + this.props.project.project} path={navbarItems.parent + "/" + this.props.project.project}>{this.props.project.project}</ProjectItem>)
        return <>{...navbarItems.acc}</>;
    }
}

export function getBaseURL(project: ProjectName, ...paths: string[]) {
    return "/p/" + project.parent.map(x => encodeURIComponent(x) + "/_/").join("") + encodeURIComponent(project.project) + paths.map(x => "/" + encodeURIComponent(x)).join("");
}

export function getAPIURL(project: ProjectName, ...paths: string[]) {
    return "/api/projects/" + project.parent.map(x => encodeURIComponent(x) + "/sub/").join("") + encodeURIComponent(project.project) + paths.map(x => "/" + encodeURIComponent(x)).join("");
}