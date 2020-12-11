import { assert } from 'chai';
import { Graph, Node } from '../../types';

describe('Graph', function() {
	context('given an empty graph', function() {
		let graph: Graph;

		beforeEach(() => {
			graph = new Graph();
		});
		
		context('when a node with extra links and backlinks is added', function() {
			const firstNode = new Node('firstNodeId', '/tmp/nodeOne.md', 'Node One');
			firstNode.addLink('bogusLink');
			firstNode.addBacklink('bogusBacklink');
			let retrievedNode: Node | undefined;
			beforeEach(() => {
				graph.addNode(firstNode);
				retrievedNode = graph.getNode(firstNode.id);
			});
			
			it('appears in the graph', function() {
				assert.exists(retrievedNode);
			});

			it('does not remove the broken links', function() {
				assert.equal(retrievedNode?.links.size, firstNode.links.size);
			});

			it('does not remove the broken backlinks', function() {
				assert.equal(retrievedNode?.backlinks.size, firstNode.backlinks.size);
			});
			
			context("when fixEdges is called on the graph", function() {
				let retrievedNode: Node | undefined;
				beforeEach(() => {
					graph.fixEdges();
					retrievedNode = graph.getNode(firstNode.id);
				});

				it('removes the broken links', function() {
					assert.equal(retrievedNode?.links.size, 0);
				});

				it('removes the broken backlinks', function() {
					assert.equal(retrievedNode?.backlinks.size, 0);
				});
			});
			
			context("when a second node is added", function() {
				const secondNode = new Node('secondNodeId', '/tmp/nodeTwo.md', 'Node Two');
				beforeEach(() => graph.addNode(secondNode));

				context("when a link is added from the first node to the second node", function() {
					beforeEach(() => graph.addLink(firstNode.id, secondNode.id));

					it("adds the link to the first node", function() {
						const retrievedNode = graph.getNode(firstNode.id);
						assert.exists(retrievedNode);
						assert.include([...retrievedNode?.links.values()!], secondNode.id);
					});

					it("does not add the backlink to the second node", function() {
						const retrievedNode = graph.getNode(secondNode.id);
						assert.exists(retrievedNode);
						assert.notInclude([...retrievedNode?.backlinks.values()!], secondNode.id);
					});
					
					context("when fixEdges is called on the graph", function() {
						let retrievedFirstNode: Node;
						let retrievedSecondNode: Node;
						beforeEach(() => {
							graph.fixEdges();
							retrievedFirstNode = graph.getNode(firstNode.id)!;
							retrievedSecondNode = graph.getNode(secondNode.id)!;
						});
						
						it("does not remove the valid link", function() {
							assert.include([...retrievedFirstNode!.links.values()], secondNode.id);
						});

						it("adds a backlink to the second node", function() {
							assert.include([...retrievedSecondNode.backlinks.values()], firstNode.id);
						});
					});
					
					context("when clearNodeLinks is called for the first node", function() {
						let retrievedFirstNode: Node;
						let retrievedSecondNode: Node;
						beforeEach(() => {
							graph.clearNodeLinks(firstNode.id);
							retrievedFirstNode = graph.getNode(firstNode.id)!;
							retrievedSecondNode = graph.getNode(secondNode.id)!;
						});

						it("removes all links from the first node", function() {
							assert.equal(retrievedFirstNode!.links.size, 0);
						});

						it("removes the backlink from the first node", function() {
							assert.notInclude([...retrievedSecondNode!.backlinks.values()], firstNode.id);
						});
					});
				});
			});
		});
	});
});