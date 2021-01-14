import { ProjectMember } from 'components/projectlist';
import React from 'react';
import { FailResponses, FileResponse, load, request, Response } from 'utils/xhr';
import { getAPIURL, ProjectName, ProjectPageProps } from './common';

interface ProviderProps<T> extends ProjectPageProps {
    show: (project: T) => JSX.Element;
    error: (error: FailResponses) => JSX.Element;
};

interface ProviderState<T> {
    data: "loading" | Response<T>;
    lastProps: ProjectName | null;
};

export interface ProjectInfo {
    name: string;
    description: string;
    owner: string;
    private: boolean;
    default_branch_permissions: "NONE" | "READ" | "WRITE";
    sshPort: number;
};

function equalArrays(a: string[] | undefined, b: string[] | undefined) {
    if (a == null) {
        if (b == null) {
            return true;
        } else {
            return false;
        }
    } else {
        if (b == null) {
            return false;
        } else {
            return a.length === b.length && a.every((v, i) => v === b[i]);
        }
    }
}

interface DataState<T extends object> {
    data: "loading" | {error: FailResponses} | {data: T};
    lastProps: {
        parent: string[];
        project: string;
    } | null;
};

export abstract class DataProvider<T extends object, P extends ProjectPageProps = ProjectPageProps> extends React.Component<P, DataState<T>> {
    state: DataState<T> = {
        data: "loading",
        lastProps: null
    };

    abstract update(): {[key in keyof T]: Promise<Response<T[key]>>};
    loadData() {
        //If the props haven't changed, then there is no reason to update anything
        if (this.props.project.project === this.state.lastProps?.project && equalArrays(this.props.project.parent, this.state.lastProps?.parent)) {
            return;
        }

        //Remove old data and replace it with "loading" and update the last props to be the current props
        this.setState(state => ({
            ...state,
            data: "loading",
            lastProps: this.props.project
        }));

        let data: T = {} as T;
        let error: FailResponses | null = null;
        //Get all pieces of data that are being fetched
        const update = this.update();

        let updated = 0;
        for (let key in update) {
            //Count the amount of pieces still being fetched
            updated++;
            update[key].then(result => {
                if (result.type === "success") {
                    data[key] = result.data;
                } else {
                    if (error == null) {
                        error = result;
                    }
                }
                updated--;
                //Once all pieces are fetched
                if (updated === 0) {
                    this.setState(state => {
                        if (error != null) {
                            return {...state, data: {error}};
                        } else {
                            return {...state, data: {data}};
                        }
                    });
                }
            });
        }
    }

    componentDidMount() {
        this.loadData();
    }

    componentDidUpdate() {
        this.loadData();
    }

    render() {
        if (this.state.data === "loading") {
            return this.renderLoading();
        } else if ("error" in this.state.data) {
            return this.renderError(this.state.data.error);
        } else {
            return this.renderSuccess(this.state.data.data);
        }
    }

    abstract renderError(error: FailResponses): JSX.Element;
    abstract renderSuccess(data: T): JSX.Element;
    abstract renderLoading(): JSX.Element;
};

abstract class ProjectProvider<T> extends React.Component<ProviderProps<T>, ProviderState<T>> {
    state: ProviderState<T> = {
        data: "loading",
        lastProps: null
    };

    abstract update(): Promise<Response<T>>;
    loadData() {
        //If the props haven't changed, then there is no reason to update anything
        if (this.props.project.project === this.state.lastProps?.project && equalArrays(this.props.project.parent, this.state.lastProps?.parent)) {
            return;
        }

        //Remove old data and replace it with "loading"
        this.setState(state => ({
            ...state,
            data: "loading",
            lastProps: this.props.project
        }));
        this.update().then(result => {
            this.setState(state => ({
                ...state,
                data: result
            }));
        });
    }

    componentDidMount() {
        this.loadData();
    }

    componentDidUpdate() {
        this.loadData();
    }

    render() {
        if (this.state.data === "loading") {
            return this.props.children;
        } else if (this.state.data.type === "success") {
            return this.props.show(this.state.data.data);
        } else {
            return this.props.error(this.state.data);
        }
    }
};

export class ProjectInfoProvider extends ProjectProvider<ProjectInfo> {
    update() {
        return request<ProjectInfo>("GET", getAPIURL(this.props.project));
    }
};

export class ReadmeProvider extends ProjectProvider<FileResponse> {
    update() {
        return load("GET", getAPIURL(this.props.project, "src", "master", "README.md"));
    }
}

export class ProjectMembersProvider extends ProjectProvider<ProjectMember[]> {
    update() {
        return request<ProjectMember[]>("GET", getAPIURL(this.props.project, "members"));
    }
}