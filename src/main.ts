import {Plugin,MarkdownView, TFile, Modal, App, Notice} from "obsidian";





class TagsSuggestModal extends Modal {
	plugin: QuickTagsPlugin;
	title: string;
	tags: Array<string>;
	
	tagInputContainer: HTMLDivElement;
	tagInput: HTMLDivElement;
	tagItems: Array<HTMLDivElement>;

	onclose: (tags: Array<string>) => void;
	modified: boolean;




	constructor(app: App, plugin: QuickTagsPlugin,title: string, tags: Array<string>, onclose: (tags: Array<string>)=>void) {
		super(app);
		this.tags = tags
		this.title = title;

		this.tagItems = [];
		this.onclose = onclose;
		this.modified = false;

		
	}


	private addTagItem(text: string) {

		
		const tagItem = document.createElement("div");
		tagItem.addClass("qt-array-item")

		this.tagInputContainer.insertBefore(tagItem,this.tagInput,);


		// tagItem.textContent = text;

		tagItem.createDiv("qt-array-item-content").textContent = text;
		const icon = tagItem.createDiv("qt-array-item-icon");
		icon.onclick = (ev) => {
			this.tagItems.remove(tagItem);
			this.tagInputContainer.removeChild(tagItem);
			this.tagInput.focus();
		}
		this.tagItems.push(tagItem);

	}

	private addTag(text: string) {
		if (text) {
			for (var i = 0; i < this.tagItems.length; i++) {
				if (this.tagItems[i].textContent === text) {
					text = null;
					new Notice("标签重复",500);
					break;
				}
			}

			if (text) {
				this.addTagItem(text);
				this.modified = true;
				this.tagInput.textContent = "";
			}
		}
	}

	private createTagInput() {
		this.tagInput = this.tagInputContainer.createDiv("qt-array-input");
		this.tagInput.contentEditable = "true";

		this.tagInput.onkeydown = (ev) => {

			if (ev.key === "Backspace" && this.tagInput.textContent === "" && this.tagItems.length) {
				const item = this.tagItems.last()
				this.tagItems.remove(item);
				this.tagInputContainer.removeChild(item);
				this.modified = true;
			}
		}

		this.tagInput.onkeypress = (ev) => {

			const text = this.tagInput.textContent.trim();
			if (ev.key === 'Enter') {
				this.addTag(text);
				this.close();
				return false;
			}

			if (ev.key === ' ') {
				this.addTag(text);
				return false;
			}

		
		}

		this.tagInput.focus();

	}

	onOpen(): void {
		
		// console.log(this.title);
		// this.contentEl.createEl("h2").textContent = this.title;

		this.tagInputContainer = this.contentEl.createDiv("qt-array-input-container");
		this.createTagInput();
		
		this.titleEl.textContent = this.title;
		this.modified = false;
		this.tags.map((t) => {this.addTagItem(t)});

	}

	onClose(): void {

		this.tags = this.tagItems.map((item) => item.textContent);

		if (this.onclose) {
			this.onclose( this.modified ?　this.tags : null);
		}
	}
}



export default class QuickTagsPlugin extends Plugin {

	fileTocMap: Map<TFile,any> = new Map();

	private async modifyFileTags(file: TFile,tags: Array<string>) {
		return this.app.vault.cachedRead(file).then((content) => {
			const rYaml = /^(---\r?\n[\s\S]*\r?\n)---/;
			const rTags = /tags:(.*)\r?\n((?:- .*)\r?\n)*/g;

			const oldYaml = rYaml.exec(content)?.[0]
			var newYaml = oldYaml || "---\r\n---"

			const oldTags = rTags.exec(newYaml)?.[0];
			const newTags = `tags: ${tags.join(",")}\r\n`;

			if (oldTags) {
				newYaml = newYaml.replace(oldTags,newTags);
			} else {
				newYaml = newYaml.substring(0,newYaml.length-3) + newTags + "---"
			}

			if (oldYaml) {
				content = content.replace(oldYaml,newYaml);
			} else {
				content = newYaml + "\r\n" + content;
			}

			return this.app.vault.modify(file,content);
		});
	}

	private async fetchAllTags() {
		const allTags = new Set<string>()
		this.app.vault.getMarkdownFiles().map((file) => {

			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			var tags: Array<string> = frontmatter?.tags || frontmatter?.tag || [];

			if (typeof tags === "string") {
				tags = (tags as string).split(",").map((t) => t.trim());
			}
			tags.map((t) => allTags.add(t));

		});
		return Array.from(allTags);
	}

	async onload() {
		this.fetchAllTags().then((allTags) => {
			// console.log(allTags);

		})

		this.addCommand({
			id: 'update-tags-in-current-file',
			name: 'Update tags in current file',
			checkCallback: (checking: boolean) => {

				if (checking) {
					const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
					if (!markdownView) return false;
					else return true;
				}

				const file = this.app.workspace.getActiveViewOfType(MarkdownView).file;
				var tags = this.app.metadataCache.getFileCache(file)?.frontmatter?.tags || this.app.metadataCache.getFileCache(file)?.frontmatter?.tag || [];

				if (typeof tags === "string") tags = tags.split(",").map(t => t.trim());
				
				const modal = new TagsSuggestModal(this.app, this,file.basename, tags, (newTags: Array<string>) => {
					if (newTags) {
						this.modifyFileTags(file,newTags);
					}
				})
				modal.open()


			}
		});


	}

	onunload() {
	}
}
