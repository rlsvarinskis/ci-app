import Page from 'components/page';
import React from 'react';
import { BrowserRouter as Router, match, Route, Switch } from 'react-router-dom';
import { History, Location } from 'history';
import ProjectSidebar from 'components/projectsidebar';
import ProjectList from 'components/projectlist';
import { User } from 'App';
import ProjectMainPage from './projectmain';
import ProjectBranchesPage from './projectbranches';

interface ProjectPageProps {
    match: match<{
        project: string;
    }>;
    history: History;
    location: Location;
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
        const current = [...this.props.parent, this.props.match.params.project];
        const baseurl = "/p/" + this.props.parent.map(x => x + "/_/") + this.props.match.params.project;
        return <Switch>
            <Route path={baseurl + "/_/:project"} render={props => <ProjectPage {...props} parent={current} user={this.props.user}></ProjectPage>}></Route>
            <Route path={baseurl + "/"}>
                <Route exact path={baseurl}>
                    <ProjectMainPage parent={this.props.parent} project={this.props.match.params.project} user={this.props.user}></ProjectMainPage>
                </Route>
                <Route path={baseurl + "/src"}>
                    <ProjectSidebar baseurl={baseurl} active="src"></ProjectSidebar>
                    <div className="content">
                        This should contain source code
                    </div>
                </Route>
                <Route path={baseurl + "/branches"}>
                    <ProjectSidebar baseurl={baseurl} active="branches"></ProjectSidebar>
                    <div className="content">
                        <ProjectBranchesPage parent={this.props.parent} project={this.props.match.params.project} user={this.props.user}></ProjectBranchesPage>
                    </div>
                </Route>
                <Route path={baseurl + "/ci"}>
                    <ProjectSidebar baseurl={baseurl} active="ci"></ProjectSidebar>
                    <div className="content">
                        This should contain scripts
                    </div>
                </Route>
                <Route path={baseurl + "/sub"}>
                    <ProjectSidebar baseurl={baseurl} active="sub"></ProjectSidebar>
                    <div className="content">
                        <ProjectList parent={current} user={this.props.user}></ProjectList>
                    </div>
                </Route>
            </Route>
        </Switch>
    }
}