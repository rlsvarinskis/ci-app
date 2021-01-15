import React from 'react';
import { BrowserRouter as Router, match, Route, Switch } from 'react-router-dom';
import ProjectSidebar from 'components/sidebar';
import { User } from 'App';
import ProjectMainPage from './description';
import ProjectBranchesPage from './branches';
import { getBaseURL } from './common';
import { ProjectSource } from './source';
import ProjectSubprojectsPage from './subprojects';
import { ProjectDeveloperPage } from './developers';
import { ProjectCIPage, ProjectPushPage } from './ci';

interface ProjectPageProps {
    match: match<{
        project: string;
    }>;
    parent: string[];
    user: User;
};

export default class ProjectPage extends React.Component<ProjectPageProps> {
    render() {
        const project = this.props.match.params.project;
        const current = [...this.props.parent, project];
        const baseurl = getBaseURL({parent: this.props.parent, project});
        const projectName = {
            parent: this.props.parent,
            project: project
        };
        return <Switch>
            <Route path={baseurl + "/_/:project"} render={props => <ProjectPage match={props.match} parent={current} user={this.props.user} />} />
            <Route path={baseurl + "/"}>
                <Switch>
                    <Route exact path={baseurl}>
                        <ProjectMainPage project={projectName} user={this.props.user} />
                    </Route>
                    <Route path={baseurl + "/devs"}>
                        <ProjectDeveloperPage project={projectName} user={this.props.user} />
                    </Route>
                    <Route path={baseurl + "/src"}>
                        <ProjectSource user={this.props.user} project={projectName} file={[]} />
                    </Route>
                    <Route path={baseurl + "/branches"}>
                        <ProjectBranchesPage project={projectName} user={this.props.user} />
                    </Route>
                    <Route path={baseurl + "/ci/:push_id"} render={props => <ProjectPushPage project={projectName} user={this.props.user} push={props.match.params.push_id} />} />
                    <Route path={baseurl + "/ci"}>
                        <ProjectCIPage project={projectName} user={this.props.user} />
                    </Route>
                    <Route path={baseurl + "/sub"}>
                        <ProjectSubprojectsPage project={projectName} user={this.props.user} />
                    </Route>
                </Switch>
            </Route>
        </Switch>
    }
}