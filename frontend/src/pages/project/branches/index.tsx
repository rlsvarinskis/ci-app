import React from 'react';
import Page from 'components/page';
import { getAPIURL, getBaseURL, ProjectNavbarItems, ProjectPageProps } from '../common';
import Navbar from 'components/navbar';
import ProjectSidebar from 'components/projectsidebar';
import page from 'pages/project/page/page.less';
import { BranchesItem } from 'components/navbar/item';
import { Branch, BranchSettings } from './branch';
import { request } from 'utils/xhr';

interface ProjectMainPageState {
    branches: {[key: string]: Branch};
    error: any;
};

export default class ProjectBranchesPage extends React.Component<ProjectPageProps, ProjectMainPageState> {
    state: ProjectMainPageState = {
        branches: {},
        error: null,
    };

    componentDidMount() {
        request<{[key: string]: Branch}>("GET", getAPIURL(this.props.project, "branches")).then(result => {
            if (result.type === "success") {
                this.setState(state => ({
                    ...state,
                    branches: result.data,
                }));
            } else {
                this.setState(state => ({
                    ...state,
                    branches: {},
                    error: result,
                }));
            }
        });
    }

    updateBranch(b: Branch) {
        this.setState(state => ({
            ...state,
            branches: {
                ...state.branches,
                [b.name]: b
            }
        }));
    }

    render() {
        if (this.state.error != null) {
            if (this.state.error.type === "forbidden") {
                return <Page><h1>Forbidden</h1></Page>
            } else if (this.state.error.type === "not_found") {
                return <Page><h1>Not found</h1></Page>
            }
        }
        const allBranches = Object.keys(this.state.branches);
        return <>
            <Navbar user={this.props.user}><ProjectNavbarItems project={this.props.project} /><BranchesItem path={getBaseURL(this.props.project, "branches")}>Branches</BranchesItem></Navbar>
            <ProjectSidebar baseurl={getBaseURL(this.props.project)} active="branches"></ProjectSidebar>
            <div className={page.content + " " + page.mini}>
                <div className={page.page}>
                    <h1>Branches</h1>
                    {allBranches.map(x => this.state.branches[x]).map(x => <BranchSettings project={this.props.project} user={this.props.user} branch={x} onUpdate={(b) => this.updateBranch(b)} />)}
                </div>
            </div>
        </>
    }
};