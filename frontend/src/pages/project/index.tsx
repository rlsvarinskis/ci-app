import Page from 'components/page';
import React from 'react';
import { BrowserRouter as Router, match, Route, Switch } from 'react-router-dom';
import { History, Location } from 'history';
import ProjectSidebar from 'components/projectsidebar';
import ProjectList from 'components/projectlist';
import { User } from 'App';
import ProjectMainPage from './description';
import ProjectBranchesPage from './branches';
import { getBaseURL } from './common';
import { ProjectSource } from './source';
import ProjectSubprojectsPage from './subprojects';
import { ProjectDeveloperPage } from './developers';

interface ProjectPageProps {
    match: match<{
        project: string;
    }>;
    parent: string[];
    user: User;
};

interface ProjectPageState {

};

export default class ProjectPage extends React.Component<ProjectPageProps, ProjectPageState> {
    constructor(props: ProjectPageProps) {
        super(props);
    }

    render() {
        const project = this.props.match.params.project;
        const current = [...this.props.parent, project];
        const baseurl = getBaseURL({parent: this.props.parent, project});
        const projectName = {
            parent: this.props.parent,
            project: project
        };
        return <Switch>
            <Route path={baseurl + "/_/:project"} render={props => <ProjectPage match={props.match} parent={current} user={this.props.user}></ProjectPage>}></Route>
            <Route path={baseurl + "/"}>
                <Route exact path={baseurl}>
                    <ProjectMainPage project={projectName} user={this.props.user}></ProjectMainPage>
                </Route>
                <Route path={baseurl + "/devs"}>
                    <ProjectDeveloperPage project={projectName} user={this.props.user} />
                </Route>
                <Route path={baseurl + "/src"}>
                    <ProjectSource user={this.props.user} project={projectName} file={[]} />
                </Route>
                <Route path={baseurl + "/branches"}>
                    <ProjectBranchesPage project={projectName} user={this.props.user}></ProjectBranchesPage>
                </Route>
                <Route path={baseurl + "/ci"}>
                    <ProjectSidebar baseurl={baseurl} active="ci"></ProjectSidebar>
                    <div className="content">
                        This should contain scripts
                    </div>
                </Route>
                <Route path={baseurl + "/sub"}>
                    <ProjectSubprojectsPage project={projectName} user={this.props.user}></ProjectSubprojectsPage>
                </Route>
            </Route>
        </Switch>
    }
}