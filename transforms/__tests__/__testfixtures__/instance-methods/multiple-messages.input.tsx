import { User, Post } from "./gen/example_pb";

const user: User = new User({ name: "Homer" });
const post: Post = new Post({ title: "Hello" });
const userBytes = user.toBinary();
const postStr = post.toJsonString();
