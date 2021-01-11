import { User } from 'App';
import React from 'react';
import { ProjectMember } from 'components/projectlist';
import Page from 'components/page';
import { BranchPermissions, BranchPermissionsText } from 'components/projectmaker';
import page from 'pages/project/page.less';
import infobar from 'pages/project/infobar.less';
import ProjectSidebar from 'components/projectsidebar';
import { FileItem, UserItem } from './project/useritem';
import ToggleButton from 'components/togglebutton';
import selects from 'components/select/index.less';
import { CloneMenu } from 'components/clonemenu';

interface ProjectMainPageProps {
    parent: string[];
    project: string;
    user: User;
};

interface ProjectMainPageState {
    members: ProjectMember[] | "loading" | null;
    projectInfo: {
        description: string;
        name: string;
        owner: string;
        private: boolean;
        default_branch_permissions: "NONE" | "READ" | "WRITE";
    } | "loading" | null;
    readme: {readme: string} | "none" | "loading" | null;
    error: any;
    loadingPrivate: boolean | string;
    loadingDefaultPerm: boolean | string;
    loadingMember: boolean | string;
};

interface ProjectInfo {
    id: number,
    name: string,
    description: string,
    owner: number;
    parent: number;
    private: number;
    default_branch_permissions: number;
    username: string;
};

export default class ProjectMainPage extends React.Component<ProjectMainPageProps, ProjectMainPageState> {
    state: ProjectMainPageState = {
        members: null,
        projectInfo: null,
        readme: null,
        error: null,
        loadingPrivate: false,
        loadingDefaultPerm: false,
        loadingMember: false,
    };

    constructor(props: ProjectMainPageProps) {
        super(props);
        this.loadMembers();
        this.loadPI();
        this.loadRM();
    }

    loadMembers() {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "/api/projects/" + this.props.parent.map(x => x + "/sub/").join("") + this.props.project);
        xhr.responseType = "json";
        xhr.onreadystatechange = evt => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    this.setState(state => ({
                        ...state,
                        projectInfo: xhr.response.data,
                    }));
                } else {
                    this.setState(state => ({
                        ...state,
                        projectInfo: null,
                        error: xhr.response,
                    }))
                }
            }
        };
        xhr.send();
        this.state.projectInfo = "loading";
    }

    loadPI() {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "/api/projects/" + this.props.parent.map(x => x + "/sub/").join("") + this.props.project + "/members");
        xhr.responseType = "json";
        xhr.onreadystatechange = evt => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    this.setState(state => ({
                        ...state,
                        members: xhr.response.data,
                    }));
                } else {
                    this.setState(state => ({
                        ...state,
                        members: null,
                        error: xhr.response,
                    }))
                }
            }
        };
        xhr.send();
        this.state.members = "loading";
    }

    loadRM() {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "/api/projects/" + this.props.parent.map(x => x + "/sub/").join("") + this.props.project + "/src/master/README.md");
        xhr.onreadystatechange = evt => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    this.setState(state => ({
                        ...state,
                        readme: xhr.response,
                    }));
                } else {
                    this.setState(state => ({
                        ...state,
                        readme: null,
                    }))
                }
            }
        };
        xhr.send();
        this.state.readme = "loading";
    }

    addUser(evt: React.FormEvent<HTMLFormElement>) {
        evt.preventDefault();

        const el = evt.currentTarget.elements;

        const res = {
            username: (el.namedItem("username") as HTMLInputElement).value,
            mod: false,
            make_branches: (el.namedItem("make_branches") as HTMLInputElement).checked,
            make_subprojects: (el.namedItem("make_subprojects") as HTMLInputElement).checked,
        };

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/projects/" + this.props.parent.map(x => x + "/sub/").join("") + this.props.project + "/members");
        xhr.setRequestHeader("Content-type", "application/json");
        xhr.onreadystatechange = evt => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    this.setState(state => {
                        if (state.members !== "loading" && state.members != null) {
                            state.members.push(res);
                        }
                        return {
                            ...state,
                            loadingMember: false,
                        }
                    });
                } else {
                    this.setState(state => ({
                        ...state,
                        loadingMember: xhr.response.message,
                    }))
                }
            }
        };
        xhr.send(JSON.stringify(res));
        this.setState(state => ({
            ...state,
            loadingMember: true,
        }));
        return false;
    }

    setUserB(evt: React.MouseEvent<HTMLInputElement, MouseEvent>, user: ProjectMember) {
        evt.preventDefault();
        var xhr = new XMLHttpRequest();
        const res = {
            mod: user.mod,
            make_branches: evt.currentTarget.checked,
            make_subprojects: user.make_subprojects,
        };
        xhr.open("PUT", "/api/projects/" + this.props.parent.map(x => x + "/sub/").join("") + this.props.project + "/members/" + user.username);
        xhr.setRequestHeader("Content-type", "application/json");
        xhr.onreadystatechange = evt => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    this.setState(state => {
                        if (state.members !== "loading" && state.members != null) {
                            const tr = state.members.find(x => x.username === user.username);
                            if (tr != null) {
                                tr.make_branches = res.make_branches;
                            }
                        }
                        return {
                            ...state,
                        }
                    });
                } else {
                    this.setState(state => ({
                        ...state,
                    }));
                }
            }
        };
        xhr.send(JSON.stringify(res));
        return false;
    }

    setUserS(evt: React.MouseEvent<HTMLInputElement, MouseEvent>, user: ProjectMember) {
        evt.preventDefault();
        var xhr = new XMLHttpRequest();
        const res = {
            mod: user.mod,
            make_branches: user.make_branches,
            make_subprojects: evt.currentTarget.checked,
        };
        xhr.open("PUT", "/api/projects/" + this.props.parent.map(x => x + "/sub/").join("") + this.props.project + "/members/" + user.username);
        xhr.setRequestHeader("Content-type", "application/json");
        xhr.onreadystatechange = evt => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    this.setState(state => {
                        if (state.members !== "loading" && state.members != null) {
                            const tr = state.members.find(x => x.username === user.username);
                            if (tr != null) {
                                tr.make_subprojects = res.make_subprojects;
                            }
                        }
                        return {
                            ...state,
                        }
                    });
                } else {
                    this.setState(state => ({
                        ...state,
                    }));
                }
            }
        };
        xhr.send(JSON.stringify(res));
        return false;
    }

    delUser(user: ProjectMember) {
        var xhr = new XMLHttpRequest();
        xhr.open("DELETE", "/api/projects/" + this.props.parent.map(x => x + "/sub/").join("") + this.props.project + "/members/" + user.username);
        xhr.onreadystatechange = evt => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    this.setState(state => {
                        var newMem = state.members;
                        if (newMem !== "loading" && newMem != null) {
                            newMem = newMem.filter(x => x.username !== user.username);
                        }
                        return {
                            ...state,
                            members: newMem,
                        };
                    });
                } else {
                    this.setState(state => ({
                        ...state,
                    }));
                }
            }
        };
        xhr.send();
    }

    setPrivate(newVal: boolean) {
        var xhr = new XMLHttpRequest();
        xhr.open("PUT", "/api/projects/" + this.props.parent.map(x => x + "/sub/").join("") + this.props.project + "/private");
        xhr.setRequestHeader("Content-type", "application/json");
        xhr.onreadystatechange = evt => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    this.setState(state => {
                        if (state.projectInfo !== "loading" && state.projectInfo != null) {
                            state.projectInfo.private = !state.projectInfo.private;
                        }
                        return {
                            ...state,
                            loadingPrivate: false,
                        }
                    });
                } else {
                    this.setState(state => ({
                        ...state,
                        loadingPrivate: xhr.response.message,
                    }))
                }
            }
        };
        xhr.send(JSON.stringify(newVal));
        this.setState(state => ({
            ...state,
            loadingPrivate: true,
        }));
    }

    setDefaultBP(evt: React.ChangeEvent<HTMLSelectElement>) {
        evt.preventDefault();
        const val = evt.currentTarget.value as "NONE" | "READ" | "WRITE";
        var xhr = new XMLHttpRequest();
        xhr.open("PUT", "/api/projects/" + this.props.parent.map(x => x + "/sub/").join("") + this.props.project + "/default_branch_permissions");
        xhr.setRequestHeader("Content-type", "application/json");
        xhr.onreadystatechange = evt => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    this.setState(state => {
                        if (state.projectInfo !== "loading" && state.projectInfo != null) {
                            state.projectInfo.default_branch_permissions = val;
                        }
                        return {
                            ...state,
                            loadingDefaultPerm: false,
                        }
                    });
                } else {
                    this.setState(state => ({
                        ...state,
                        loadingDefaultPerm: xhr.response.message,
                    }))
                }
            }
        };
        xhr.send(JSON.stringify(val));
        this.setState(state => ({
            ...state,
            loadingDefaultPerm: true,
        }));
        return false;
    }

    render() {
        if (this.state.error != null) {
            if (this.state.error.type === "forbidden") {
                return <Page><h1>Forbidden</h1></Page>
            } else if (this.state.error.type === "not_found") {
                return <Page><h1>Not found</h1></Page>
            }
        }
        const isOwner = this.state.projectInfo != null && this.state.projectInfo != "loading" && this.state.projectInfo.owner === this.props.user.username;
        return <div className={page.content}>
            <ProjectSidebar baseurl={"/p/" + this.props.parent.map(x => x + "/_/") + this.props.project} active="main"></ProjectSidebar>
            <div className={page.page}>
                {
                    isOwner ? <div>
                        <p>
                            Default branch permission: <select className={selects.select} onChange={evt => this.setDefaultBP(evt)} disabled={this.state.projectInfo === "loading" || this.state.projectInfo == null || this.state.loadingDefaultPerm !== false} value={this.state.projectInfo != "loading" && this.state.projectInfo != null ? this.state.projectInfo.default_branch_permissions : ""}>{BranchPermissions.map(x => <option key={x} value={x}>{BranchPermissionsText[x]}</option>)}</select>
                        </p>
                    </div> : <></>
                }
                <div className="readme">
                    {
                        this.state.readme === "none" ? <h4>No README.md</h4> :
                        this.state.readme === "loading" ? <h4>Loading README.md...</h4> :
                        this.state.readme == null ? <h4>Error loading README.md</h4> :
                        <code>{this.state.readme}</code>
                    }
                </div>
                <h1>First test</h1>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Leo vel orci porta non pulvinar neque. Blandit volutpat maecenas volutpat blandit aliquam etiam. Diam in arcu cursus euismod quis viverra nibh. Luctus accumsan tortor posuere ac ut. Donec adipiscing tristique risus nec feugiat in fermentum posuere. Arcu odio ut sem nulla pharetra diam sit amet. Ut pharetra sit amet aliquam id diam maecenas ultricies mi. Risus nullam eget felis eget. Donec ultrices tincidunt arcu non sodales neque sodales ut etiam. In cursus turpis massa tincidunt.</p>
                <p>Ut tortor pretium viverra suspendisse potenti nullam ac tortor. Sodales ut eu sem integer. Suspendisse sed nisi lacus sed viverra tellus. Nec ullamcorper sit amet risus nullam eget felis. Arcu cursus euismod quis viverra nibh cras pulvinar. Nulla aliquet enim tortor at auctor urna nunc id cursus. A erat nam at lectus urna duis convallis convallis tellus. Volutpat lacus laoreet non curabitur gravida arcu ac tortor. Egestas pretium aenean pharetra magna ac placerat vestibulum lectus. Volutpat ac tincidunt vitae semper. Aenean vel elit scelerisque mauris. Pretium viverra suspendisse potenti nullam ac tortor vitae purus. Consectetur lorem donec massa sapien faucibus et molestie ac feugiat. Vestibulum sed arcu non odio euismod lacinia at quis risus. Nunc sed velit dignissim sodales. Eu mi bibendum neque egestas congue quisque. Ut enim blandit volutpat maecenas volutpat blandit aliquam. Scelerisque eu ultrices vitae auctor eu augue ut. Elit ullamcorper dignissim cras tincidunt. Venenatis cras sed felis eget velit aliquet sagittis id.</p>
                <p>Id cursus metus aliquam eleifend mi in nulla posuere sollicitudin. Sem fringilla ut morbi tincidunt augue interdum. Purus in mollis nunc sed id semper risus in. Amet commodo nulla facilisi nullam vehicula ipsum a. Massa ultricies mi quis hendrerit dolor magna eget. Mauris vitae ultricies leo integer malesuada nunc vel risus commodo. Facilisi cras fermentum odio eu feugiat pretium nibh ipsum. Enim blandit volutpat maecenas volutpat blandit aliquam etiam erat velit. Dignissim convallis aenean et tortor at. Gravida rutrum quisque non tellus orci. Tristique senectus et netus et malesuada.</p>
                <p>Nullam eget felis eget nunc. Turpis egestas sed tempus urna et. Ultrices eros in cursus turpis massa tincidunt dui ut ornare. Risus ultricies tristique nulla aliquet. Vestibulum lorem sed risus ultricies tristique nulla aliquet. Dictum varius duis at consectetur lorem donec massa sapien. Nunc eget lorem dolor sed viverra ipsum nunc aliquet bibendum. Sit amet risus nullam eget felis. Eget gravida cum sociis natoque penatibus et magnis dis. Sed vulputate mi sit amet mauris commodo quis imperdiet. Integer vitae justo eget magna fermentum iaculis eu non. Quam viverra orci sagittis eu volutpat odio facilisis. Leo vel orci porta non pulvinar neque laoreet. Non pulvinar neque laoreet suspendisse. Commodo viverra maecenas accumsan lacus vel facilisis volutpat. Amet aliquam id diam maecenas ultricies. Sagittis nisl rhoncus mattis rhoncus urna neque viverra justo. Volutpat ac tincidunt vitae semper quis lectus. Molestie nunc non blandit massa enim nec dui nunc. Erat imperdiet sed euismod nisi porta lorem mollis aliquam ut.</p>
                <p>Imperdiet massa tincidunt nunc pulvinar sapien et ligula. Convallis convallis tellus id interdum velit. Ut lectus arcu bibendum at varius vel pharetra. Aliquam eleifend mi in nulla posuere. Commodo odio aenean sed adipiscing. Tortor consequat id porta nibh venenatis cras. Volutpat odio facilisis mauris sit amet massa vitae tortor. Lectus vestibulum mattis ullamcorper velit sed ullamcorper morbi tincidunt ornare. Et sollicitudin ac orci phasellus egestas tellus rutrum tellus pellentesque. Sit amet facilisis magna etiam. Integer quis auctor elit sed vulputate mi. Morbi tincidunt augue interdum velit euismod in pellentesque massa placerat. Venenatis cras sed felis eget velit aliquet. Amet porttitor eget dolor morbi non arcu. Feugiat nisl pretium fusce id velit. Est pellentesque elit ullamcorper dignissim cras tincidunt lobortis feugiat vivamus. Viverra orci sagittis eu volutpat odio.</p>
                <p>Cursus turpis massa tincidunt dui. Risus at ultrices mi tempus. Egestas tellus rutrum tellus pellentesque eu tincidunt. In est ante in nibh mauris cursus mattis. Erat imperdiet sed euismod nisi porta lorem. Pretium viverra suspendisse potenti nullam ac tortor vitae purus faucibus. Arcu risus quis varius quam quisque id diam. Amet est placerat in egestas erat imperdiet. Nunc id cursus metus aliquam eleifend. Gravida neque convallis a cras semper auctor neque. Et sollicitudin ac orci phasellus. Risus feugiat in ante metus. Elementum nibh tellus molestie nunc non blandit massa enim. Lorem ipsum dolor sit amet consectetur adipiscing elit ut.</p>
                <p>Potenti nullam ac tortor vitae purus faucibus ornare suspendisse sed. Suscipit tellus mauris a diam. Ut venenatis tellus in metus vulputate eu scelerisque felis imperdiet. Dolor sit amet consectetur adipiscing. Magna ac placerat vestibulum lectus mauris. Eu mi bibendum neque egestas congue quisque egestas diam in. Integer feugiat scelerisque varius morbi enim. Pulvinar mattis nunc sed blandit libero volutpat sed cras ornare. Id cursus metus aliquam eleifend mi. Est lorem ipsum dolor sit amet consectetur adipiscing elit pellentesque. Turpis in eu mi bibendum neque egestas congue. Congue nisi vitae suscipit tellus mauris a diam maecenas sed. Pellentesque diam volutpat commodo sed egestas egestas. Volutpat blandit aliquam etiam erat velit scelerisque. Sit amet dictum sit amet justo donec. Eget lorem dolor sed viverra. Tortor dignissim convallis aenean et tortor at risus viverra.</p>
                <p>Aliquam malesuada bibendum arcu vitae elementum. Pulvinar etiam non quam lacus suspendisse faucibus interdum posuere lorem. Commodo sed egestas egestas fringilla phasellus faucibus scelerisque eleifend. Posuere ac ut consequat semper viverra. Aliquam etiam erat velit scelerisque in. Eget nullam non nisi est sit amet facilisis magna etiam. Sed viverra tellus in hac habitasse platea dictumst vestibulum. Massa tincidunt nunc pulvinar sapien et ligula ullamcorper malesuada. Feugiat sed lectus vestibulum mattis ullamcorper velit sed ullamcorper. Elementum curabitur vitae nunc sed velit dignissim sodales ut. Feugiat vivamus at augue eget arcu dictum varius duis. Id venenatis a condimentum vitae sapien pellentesque habitant morbi tristique. Ut venenatis tellus in metus vulputate eu scelerisque felis imperdiet. Amet aliquam id diam maecenas ultricies. Aliquam vestibulum morbi blandit cursus. Suspendisse ultrices gravida dictum fusce ut placerat orci nulla. In tellus integer feugiat scelerisque varius morbi enim nunc.</p>
                <p>Vel risus commodo viverra maecenas accumsan lacus vel facilisis. Fringilla est ullamcorper eget nulla facilisi. Mi in nulla posuere sollicitudin aliquam ultrices. Morbi leo urna molestie at elementum. Ultrices vitae auctor eu augue. A condimentum vitae sapien pellentesque habitant. Scelerisque mauris pellentesque pulvinar pellentesque habitant morbi tristique senectus. Tincidunt id aliquet risus feugiat. Duis at tellus at urna. Bibendum ut tristique et egestas quis ipsum. Et odio pellentesque diam volutpat commodo sed egestas egestas fringilla. Sit amet purus gravida quis blandit turpis cursus in hac. Quam adipiscing vitae proin sagittis nisl. Accumsan in nisl nisi scelerisque. Odio tempor orci dapibus ultrices in iaculis nunc.</p>
                <p>Et ligula ullamcorper malesuada proin libero nunc consequat. Posuere lorem ipsum dolor sit amet. Rhoncus urna neque viverra justo nec ultrices dui. Risus viverra adipiscing at in. Enim ut sem viverra aliquet eget sit. Praesent elementum facilisis leo vel. Diam donec adipiscing tristique risus nec feugiat in fermentum posuere. In egestas erat imperdiet sed euismod nisi porta lorem mollis. Quam nulla porttitor massa id neque aliquam. Purus faucibus ornare suspendisse sed nisi lacus sed. Sed id semper risus in hendrerit. Ultricies mi eget mauris pharetra et. Auctor urna nunc id cursus metus aliquam. Dui id ornare arcu odio ut sem nulla. Duis ultricies lacus sed turpis tincidunt. Nisl vel pretium lectus quam id leo in. Cursus mattis molestie a iaculis at erat. Fringilla urna porttitor rhoncus dolor purus non enim praesent.</p>
            </div>
            <div className={infobar.infobar}>
                <div>
                    {/*<div className={infobar.clonebutton}><i className="fas fa-download"></i>Clone</div>*/}
                    <CloneMenu sshClone="git clone ssh://git@localhost:2222/first_test" httpClone="git clone https://localhost:8000/p/first_test.git"></CloneMenu>
                    <h3 className={infobar.projecttitle}>{this.props.project}</h3>
                    <p>{this.state.projectInfo != null && this.state.projectInfo !== "loading" ? this.state.projectInfo.description : "Error..."}</p>
                </div>
                {
                    this.state.projectInfo != null && this.state.projectInfo !== "loading" && this.state.projectInfo.owner === this.props.user.username ? <div>
                        <div className={infobar.setting}>Private <div className={infobar.settingvalue}><ToggleButton onToggle={newVal => this.setPrivate(newVal)} disabled={this.state.projectInfo == null || this.state.loadingPrivate !== false} checked={this.state.projectInfo != null ? this.state.projectInfo.private : "mixed"}></ToggleButton></div></div>
                        {/*<div className={infobar.setting}>Branch permissions: <div className={infobar.settingvalue}><ToggleButton onToggle={newVal => this.setPrivate(newVal)} disabled={this.state.projectInfo === "loading" || this.state.projectInfo == null || this.state.loadingPrivate !== false} checked={this.state.projectInfo != "loading" ? this.state.projectInfo != null ? this.state.projectInfo.private : "intermediate" : "intermediate"}></ToggleButton></div></div>*/}
                    </div> : <></>
                }
                <div>
                    <div className={infobar.sectiontitle}>Release</div>
                    <FileItem filename="Minecraft.exe" icon={{type: "url", url: "https://www.freeiconspng.com/thumbs/minecraft-png-icon/minecraft-icon-0.png"}}></FileItem>
                </div>
                <div>
                    <a href="#" className={infobar.link + " " + infobar.sectionedit}>Transfer ownership</a>
                    <div className={infobar.sectiontitle}>Owner</div>
                    {this.state.projectInfo !== "loading" ? this.state.projectInfo != null ? <UserItem username={this.state.projectInfo.owner}></UserItem> : "<ERROR>" : "<loading>"}
                </div>
                {
                    (!isOwner && this.state.members instanceof Array && this.state.members.length === 0) ? <></> : <div>
                        <a href="#" className={infobar.link + " " + infobar.sectionedit}>Change developers</a>
                        <div className={infobar.sectiontitle}>Developers</div>
                        {
                            this.state.members == null ? "<ERROR>" :
                            this.state.members === "loading" ? "<loading>" :
                                this.state.members.map(x => <UserItem key={x.username} username={x.username}></UserItem>
                                    //{isOwner ? <> Make branches: <input onClick={evt => this.setUserB(evt, x)} checked={x.make_branches} type="checkbox"></input> Make subprojects: <input onClick={evt => this.setUserS(evt, x)} checked={x.make_subprojects} type="checkbox"></input><button onClick={() => this.delUser(x)}>Remove</button></> : <></>}
                                )
                        }
                        <a href="#" className={infobar.link + " " + infobar.sectionmore}>View all developers</a>
                        {isOwner && <form onSubmit={evt => this.addUser(evt)}>
                            <input name="username" placeholder="Username"></input>
                            {" "}Make branches: <input name="make_branches" type="checkbox"></input>
                            {" "}Make subprojects: <input name="make_subprojects" type="checkbox"></input>
                            <input type="submit" value="Add user"></input>
                        </form>}
                    </div>
                }
            </div>
        </div>
    }
};