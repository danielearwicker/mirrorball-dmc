import * as React from "react";
import * as ReactDOM from "react-dom";
import { summarise } from "./summarise";

function groupBy<T>(ar: T[], keyOf: (i: T) => string) {
    const groups: { [key: string]: T[] } = {};

    for (const i of ar) {
        const key = keyOf(i);
        (groups[key] || (groups[key] = [])).push(i);
    }

    return Object.keys(groups).map(key => ({ key, items: groups[key] }));
}

interface IssueState {
    resolving: boolean;
}

class Issue extends React.Component<MirrorBall.IssueInfo, IssueState> {

    constructor(props: MirrorBall.IssueInfo) {
        super(props);
        this.state = { resolving: false };
    }

    resolve(choice: string) {

        const request = { 
            method: "POST", 
            headers: {
                "Content-type": "application/json"
            },
            body: JSON.stringify({
                id: this.props.id,
                choice
            })
        };

        this.setState({ resolving: true });

        fetch("api/mirror/resolve", request)
            .then(r => r.text())
            .catch(err => console.error(err))
            .then(() => this.setState({ resolving: false }));
    }

    render() {        
        return (
            <div className="issue">
                <div className="title">{this.props.title}</div>
                <div className="content">
                    <div className={this.props.state == MirrorBall.IssueState.Failed ? "error" : "message"}>
                        {this.props.message}
                    </div>
                    {
                        this.props.state == MirrorBall.IssueState.New ? 
                            <div className="options">
                            {
                                this.props.options.map(option => (
                                    <button key={option} 
                                        disabled={this.state.resolving} 
                                        onClick={() => this.resolve(option)}>{option}</button>
                                ))
                            }
                            </div> :
                        this.props.state == MirrorBall.IssueState.Failed ?
                            <div className="error">
                                <button onClick={() => this.resolve("")}>Clear</button>
                            </div> :
                        this.props.state == MirrorBall.IssueState.Queued ?
                            <div className="waiting">
                                Queued...
                            </div> :
                        this.props.state == MirrorBall.IssueState.Busy ?
                            <div>
                                <div className="progress">
                                    <div className="bar" style={{ width: `${this.props.progress * 100}%`}} />
                                </div> 
                                <div>{this.props.progressText}</div>
                            </div> : null
                    }                    
                </div>
            </div>
        );
    }
}

interface IssueGroupProps {
    title: string;
    issues: MirrorBall.IssueInfo[];
    options: string[];
}

function IssueGroup({title, issues, options}: IssueGroupProps) {
    return (
        <div className="group">
            <h2>{title}</h2>
            {
                options.map(option => (
                    <button>{option}</button>
                ))
            }
            {
                issues.map(issue => (
                    <Issue key={issue.id} {...issue}></Issue>                    
                ))
            }
        </div>
    );
}

interface MirrorBallAppState {
    issues: MirrorBall.IssueInfo[];
    search: string;
}

class App extends React.Component<{}, MirrorBallAppState> {

    quit = false;

    constructor(props: {}) {
        super(props);
        this.state = { issues: [], search: "" };
    }

    fetchIssues() {
        if (this.quit) {
            return;
        }
        
        fetch("api/mirror/issues")
            .then(r => r.json())
            .then((issues: MirrorBall.IssueInfo[]) => this.setState({ issues }))
            .catch(err => console.error(err))
            .then(() => {
                setTimeout(() => this.fetchIssues(), 1000);
            });
    }

    componentDidMount() {
        this.fetchIssues();
    }

    refresh = () => {
        fetch("api/mirror/diff", { method: "POST" })
            .then(r => r.text())
            .catch(err => console.error(err));
    }

    componentWillUnmount() {
        this.quit = true;
    }

    searchChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ search: e.target.value });
    }

    get foundIssues() {
        const s = this.state.search.trim();
        if (!s) {
            return this.state.issues;
        }
        return this.state.issues.filter(i => (
            i.message.indexOf(s) !== -1 ||
            i.options.some(o => o.indexOf(s) !== -1)
        ));
    }

    get groups(): IssueGroupProps[] {
        return groupBy(this.foundIssues, i => i.title).map(g => { 

            const maxOptions = g.items.map(i => i.options.length).reduce((l, r) => Math.max(l, r));
            
            const options: string[] = [];
            
            for (let n = 0; n <= maxOptions; n++) {
                const summary = summarise(g.items.map(i => i.options[n]));
                options.push(summary.map(s => s.length == 1 ? s : "...").join(""));
            }
            
            return { title: g.key, issues: g.items, options };
        });
    }

    render() {
        return (
            <div>
                <div>
                    <button onClick={this.refresh}>Refresh</button>
                    <span> Search </span>
                    <input type="text" value={this.state.search} onChange={this.searchChanged} />
                </div>
                <hr/>
            {
                this.groups.map(g => <IssueGroup {...g} key={g.title} />)
            }
            </div>
        );
    }
}

ReactDOM.render(<App/>, document.querySelector("#root"));

