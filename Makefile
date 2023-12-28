all: package

install:
	npm install

package:
	vsce package

publish:
	vsce publish

clean:
	rm -rf *.vsix

.PHONY: all install package publish clean
